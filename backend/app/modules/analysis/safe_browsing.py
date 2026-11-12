"""Google Safe Browsing v5 hash lookup for URLs admitted by AWASIN."""

import asyncio
from base64 import b64decode, b64encode
from collections import OrderedDict
from datetime import UTC, datetime
from hashlib import sha256
import json
import posixpath
import re
from time import monotonic
from urllib.parse import unquote_to_bytes

import httpx
from google.protobuf.message import DecodeError

from .safe_browsing_proto import SearchHashesResponse
from .url import Lookup, UrlTarget

ENDPOINT = "https://safebrowsing.googleapis.com/v5/hashes:search"
NAME = "Google Safe Browsing"
THREAT_CODES = {1: "MALWARE", 2: "SOCIAL_ENGINEERING", 3: "UNWANTED_SOFTWARE", 4: "POTENTIALLY_HARMFUL_APPLICATION"}
THREATS = frozenset(THREAT_CODES.values())
MAX_RESPONSE = 256 * 1024


def url_hashes(target: UrlTarget) -> set[bytes]:
    """Build the documented host suffix and path prefix expressions."""
    domain = target.registered_domain
    if not domain:
        return set()
    host_labels = target.hostname.split(".")
    domain_size = len(domain.split("."))
    hosts = {target.hostname}
    hosts.update(".".join(host_labels[-size:]) for size in range(domain_size, min(len(host_labels), domain_size + 3) + 1))

    path = target.path.encode("utf-8")
    while True:
        decoded = unquote_to_bytes(path)
        if decoded == path:
            break
        path = decoded
    trailing_slash = path.endswith((b"/", b"/.", b"/.."))
    path = posixpath.normpath(b"/" + path.lstrip(b"/"))
    if trailing_slash and path != b"/":
        path += b"/"
    escaped = "".join(f"%{byte:02X}" if byte <= 32 or byte >= 127 or byte in (35, 37) else chr(byte) for byte in path)
    parts = escaped.strip("/").split("/")
    paths = {"/", escaped}
    paths.update("/" + "/".join(parts[:depth]) + "/" for depth in range(1, min(3, len(parts) - 1) + 1))
    return {sha256((host + item).encode("ascii")).digest() for host in hosts for item in paths}


class SafeBrowsing:
    name = NAME

    def __init__(self, client: httpx.AsyncClient, key: str):
        self.client = client
        self.key = key
        self.cache: OrderedDict[bytes, tuple[float, datetime, dict[bytes, set[str]]]] = OrderedDict()

    async def lookup_url(self, target: UrlTarget) -> Lookup:
        if target.scheme_assumed or "?" in target.normalized_url or target.is_ip or not target.registered_domain:
            return Lookup("unsupported")
        hashes = url_hashes(target)
        prefixes = {digest[:4] for digest in hashes}
        now = monotonic()
        entries = {}
        for prefix in prefixes:
            cached = self.cache.pop(prefix, None)
            if cached and cached[0] > now:
                self.cache[prefix] = entries[prefix] = cached

        missing = prefixes - entries.keys()
        if missing:
            response = await self._fetch(missing)
            if isinstance(response, Lookup):
                return response
            ttl, matches = response
            checked_at = datetime.now(UTC)
            for prefix, full_hashes in matches.items():
                # Google's warning freshness limit applies even if the supplied TTL is longer.
                lifetime = min(ttl, 1800) if full_hashes else ttl
                entries[prefix] = (monotonic() + lifetime, checked_at, full_hashes)
                if lifetime:
                    self.cache[prefix] = entries[prefix]
            while len(self.cache) > 2048:
                self.cache.popitem(last=False)

        types = set()
        matched_at = []
        for digest in hashes:
            _, checked_at, matches = entries[digest[:4]]
            categories = matches.get(digest)
            if categories:
                types.update(categories)
                matched_at.append(checked_at)
        if types:
            return Lookup("match", min(matched_at), tuple(sorted(types)))
        return Lookup("no_match", min(entry[1] for entry in entries.values()))

    async def _fetch(self, prefixes: set[bytes]) -> Lookup | tuple[float, dict[bytes, dict[bytes, set[str]]]]:
        params = [("hashPrefixes", b64encode(prefix).decode("ascii")) for prefix in sorted(prefixes)]
        try:
            async with asyncio.timeout(2), self.client.stream(
                "GET", ENDPOINT, params=params,
                headers={"x-goog-api-key": self.key, "Accept": "application/x-protobuf, application/json", "Accept-Encoding": "identity"},
                follow_redirects=False,
            ) as response:
                if response.status_code == 429:
                    return Lookup("rate_limited")
                if response.status_code != 200:
                    return Lookup("unavailable")
                content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                body = bytearray()
                async for chunk in response.aiter_bytes(chunk_size=4096):
                    body.extend(chunk)
                    if len(body) > MAX_RESPONSE:
                        return Lookup("invalid_response")
            if content_type in {"application/x-protobuf", "application/protobuf"}:
                return parse_protobuf(body, prefixes)
            if content_type == "application/json":
                return parse_response(body, prefixes)
            return Lookup("invalid_response")
        except (TimeoutError, httpx.TimeoutException):
            return Lookup("timeout")
        except httpx.HTTPError:
            return Lookup("unavailable")
        except (DecodeError, ValueError, TypeError, KeyError, RecursionError):
            return Lookup("invalid_response")


def parse_protobuf(body: bytearray, prefixes: set[bytes]) -> tuple[float, dict[bytes, dict[bytes, set[str]]]]:
    response = SearchHashesResponse.FromString(bytes(body))
    duration = response.cache_duration
    if not response.HasField("cache_duration") or duration.seconds < 0 or not 0 <= duration.nanos < 1_000_000_000:
        raise ValueError("Invalid cache duration")
    matches: dict[bytes, dict[bytes, set[str]]] = {prefix: {} for prefix in prefixes}
    for item in response.full_hashes:
        digest = item.full_hash
        if len(digest) != 32 or digest[:4] not in prefixes or not item.full_hash_details:
            raise ValueError("Invalid full hash")
        for detail in item.full_hash_details:
            category = THREAT_CODES.get(detail.threat_type)
            if category and not detail.attributes:
                matches[digest[:4]].setdefault(digest, set()).add(category)
    return duration.seconds + duration.nanos / 1_000_000_000, matches


def parse_response(body: bytearray, prefixes: set[bytes]) -> tuple[float, dict[bytes, dict[bytes, set[str]]]]:
    payload = json.loads(body)
    duration = payload["cacheDuration"]
    if not re.fullmatch(r"[0-9]{1,12}(?:\.[0-9]{1,9})?s", duration):
        raise ValueError("Invalid cache duration")
    matches: dict[bytes, dict[bytes, set[str]]] = {prefix: {} for prefix in prefixes}
    entries = payload.get("fullHashes", [])
    if not isinstance(entries, list):
        raise ValueError("Invalid hash list")
    for item in entries:
        digest = b64decode(item["fullHash"], validate=True)
        details = item["fullHashDetails"]
        if len(digest) != 32 or digest[:4] not in prefixes or not isinstance(details, list) or not details:
            raise ValueError("Invalid full hash")
        for detail in details:
            threat = detail["threatType"]
            attributes = detail.get("attributes", [])
            if not isinstance(attributes, list):
                raise ValueError("Invalid threat attributes")
            # CANARY, FRAME_ONLY and unknown attributes do not apply to this top-level check.
            if threat in THREATS and not attributes:
                matches[digest[:4]].setdefault(digest, set()).add(threat)
    return float(duration[:-1]), matches
