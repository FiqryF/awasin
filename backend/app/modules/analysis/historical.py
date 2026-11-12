"""Bounded read-only integrations for historical URL reports."""

import asyncio
from base64 import urlsafe_b64encode
from collections import OrderedDict, deque
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from hmac import digest
from ipaddress import IPv6Address, ip_address
import json
import re
from time import monotonic
from secrets import token_bytes
from uuid import UUID

import httpx

from .schemas import ProviderCheck
from .url import UrlTarget, parse_url

VT = "https://www.virustotal.com/api/v3/urls/"
URLSCAN = "https://urlscan.io/api/v1/search"
DNS = "https://dns.google/resolve"
RDAP = {
    "com": "https://rdap.verisign.com/com/v1/domain/",
    "net": "https://rdap.verisign.com/net/v1/domain/",
}
MAX_BODY = 256 * 1024


def timestamp(value: object) -> datetime | None:
    try:
        if type(value) is int:
            return datetime.fromtimestamp(value, UTC)
        if isinstance(value, str):
            parsed = datetime.fromisoformat(value)
            return parsed.astimezone(UTC) if parsed.tzinfo else None
    except (ValueError, OverflowError, OSError):
        return None
    return None


def freshness(value: datetime | None, days: int = 30):
    now = datetime.now(UTC)
    if value is None or value > now + timedelta(minutes=5):
        return "unknown"
    return "recent" if now - value <= timedelta(days=days) else "stale"


class ReadOnlyLookup:
    def __init__(self, client: httpx.AsyncClient, name, *, minute: int, daily: int = 500):
        self.client, self.name = client, name
        self.minute, self.daily = minute, daily
        self.calls: deque[float] = deque()
        self.cooldown = 0.0
        self.gate = asyncio.Semaphore(2 if name == "DNS" else 1)
        self.cache: OrderedDict[bytes, tuple[float, ProviderCheck]] = OrderedDict()
        self.cache_secret = token_bytes(32)

    async def get(self, endpoint: str, cache_input: str, parse: Callable[[dict], ProviderCheck], *, params=None, headers=None):
        key = digest(self.cache_secret, cache_input.encode(), "sha256")
        now = monotonic()
        cached = self.cache.pop(key, None)
        if cached and cached[0] > now:
            self.cache[key] = cached
            return cached[1]
        while self.calls and self.calls[0] <= now - 86400:
            self.calls.popleft()
        if now < self.cooldown or len(self.calls) >= self.daily or sum(t > now - 60 for t in self.calls) >= self.minute:
            return ProviderCheck(provider=self.name, status="rate_limited")
        if self.gate.locked():
            return ProviderCheck(provider=self.name, status="rate_limited")
        async with self.gate:
            self.calls.append(now)
            try:
                async with asyncio.timeout(1.7), self.client.stream(
                    "GET", endpoint, params=params, headers={"Accept-Encoding": "identity", **(headers or {})},
                    follow_redirects=False,
                ) as response:
                    status = response.status_code
                    if status == 429 or response.headers.get("X-Rate-Limit-Remaining") == "0":
                        reset = response.headers.get("X-Rate-Limit-Reset-After", response.headers.get("Retry-After", "60"))
                        seconds = int(reset) if reset.isascii() and reset.isdecimal() and len(reset) < 8 else 60
                        self.cooldown = monotonic() + min(max(seconds, 1), 86400)
                    errors = {401: "unauthorized", 403: "unauthorized", 429: "rate_limited"}
                    if status == 404 and self.name in {"VirusTotal", "RDAP"}:
                        result = ProviderCheck(provider=self.name, status="not_found")
                    elif status != 200:
                        return ProviderCheck(provider=self.name, status=errors.get(status, "unavailable"))
                    else:
                        if response.headers.get("Content-Encoding", "identity") != "identity":
                            raise ValueError("Unexpected response compression")
                        data = bytearray()
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            data.extend(chunk)
                            if len(data) > MAX_BODY:
                                return ProviderCheck(provider=self.name, status="error")
                        payload = json.loads(data)
                        if not isinstance(payload, dict):
                            raise ValueError("Expected object")
                        result = parse(payload)
            except (TimeoutError, httpx.TimeoutException):
                return ProviderCheck(provider=self.name, status="timeout")
            except httpx.HTTPError:
                return ProviderCheck(provider=self.name, status="unavailable")
            except (ValueError, KeyError, TypeError, RecursionError, AttributeError):
                return ProviderCheck(provider=self.name, status="error")
        if result.status in {"found", "not_found"}:
            self.cache[key] = (monotonic() + (300 if result.status == "found" else 120), result)
            if len(self.cache) > 256:
                self.cache.popitem(last=False)
        return result


class VirusTotal:
    def __init__(self, client: httpx.AsyncClient, key: str):
        self.reader = ReadOnlyLookup(client, "VirusTotal", minute=4)
        self.headers = {"x-apikey": key, "Accept": "application/json"}

    async def lookup(self, target: UrlTarget):
        if (target.scheme_assumed or target.path != "/" or "?" in target.normalized_url
                or target.port is not None or target.hostname != target.registered_domain):
            return ProviderCheck(provider="VirusTotal", status="skipped",
                                 limitations=["Pencarian ini hanya menerima URL beranda dengan domain terdaftar dan skema eksplisit."])
        identifier = urlsafe_b64encode(target.normalized_url.encode()).decode("ascii").rstrip("=")
        return await self.reader.get(VT + identifier, identifier, self.parse, headers=self.headers)

    @staticmethod
    def parse(payload):
        data = payload["data"]
        if data["type"] != "url":
            raise ValueError("Expected URL report")
        attributes = data["attributes"]
        stats = attributes.get("last_analysis_stats")
        counts = {}
        if stats is not None:
            if not isinstance(stats, dict):
                raise ValueError("Expected engine stats")
            for key in ("malicious", "suspicious", "harmless", "undetected"):
                value = stats.get(key)
                if type(value) is int and 0 <= value <= 10000:
                    counts[key] = value
        verdict = "unknown"
        if counts.get("malicious"):
            verdict = "malicious"
        elif counts.get("suspicious"):
            verdict = "suspicious"
        elif counts.get("malicious") == counts.get("suspicious") == 0 and sum(counts.values()):
            verdict = "no_detection"
        observed = timestamp(attributes.get("last_analysis_date"))
        category_object = attributes.get("categories", {})
        categories = safe_categories(list(category_object.values())) if isinstance(category_object, dict) else []
        return ProviderCheck(
            provider="VirusTotal", status="found", specificity="exact_url", observed_at=observed,
            freshness=freshness(observed), verdict=verdict, counts=counts, categories=categories,
            limitations=["Laporan historis. Hitungan mesin tidak menjamin keamanan atau membuktikan konsensus independen."],
        )


def safe_categories(values):
    if not isinstance(values, list):
        return []
    allowed = (v.strip() for v in values if isinstance(v, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _/-]{0,63}", v))
    return list(dict.fromkeys(allowed))[:8]


class Urlscan:
    def __init__(self, client: httpx.AsyncClient, key: str):
        self.reader = ReadOnlyLookup(client, "urlscan.io", minute=6)
        self.headers = {"api-key": key, "Accept": "application/json"}

    async def lookup(self, target: UrlTarget):
        domain = target.registered_domain
        if not domain:
            return ProviderCheck(provider="urlscan.io", status="skipped")
        query = f'(page.apexDomain:"{domain}" OR task.apexDomain:"{domain}") AND task.visibility:public'
        return await self.reader.get(
            URLSCAN, target.normalized_url, lambda payload: self.parse(payload, target),
            params={"q": query, "size": "10"}, headers=self.headers,
        )

    @staticmethod
    def parse(payload, target):
        records = payload["results"]
        if not isinstance(records, list):
            raise ValueError("Expected historical scans")
        candidates = []
        for record in records[:10]:
            if not isinstance(record, dict):
                continue
            task = record.get("task")
            if not isinstance(task, dict) or task.get("visibility") != "public":
                continue
            try:
                raw = task["url"]
                if not isinstance(raw, str) or len(raw) > 4096:
                    continue
                historical = parse_url(raw)
            except (ValueError, KeyError):
                continue
            if historical.registered_domain != target.registered_domain:
                continue
            if not target.scheme_assumed and historical.normalized_url == target.normalized_url:
                specificity, rank = "exact_url", 3
            elif historical.hostname == target.hostname:
                specificity, rank = "hostname", 2
            else:
                specificity, rank = "related_domain", 1
            observed = timestamp(task.get("time"))
            candidates.append((rank, observed or datetime.min.replace(tzinfo=UTC), specificity, observed, record))
        if not candidates:
            return ProviderCheck(provider="urlscan.io", status="not_found")
        _, _, specificity, observed, record = max(candidates, key=lambda item: item[:2])
        task = record["task"]
        try:
            record_id = str(UUID(str(task.get("uuid") or record.get("_id"))))
        except ValueError:
            record_id = None
        verdicts = record.get("verdicts")
        categories = []
        verdict = "unknown"
        if isinstance(verdicts, dict):
            verdict_data = verdicts.get("overall", verdicts)
            if isinstance(verdict_data, dict):
                categories = safe_categories(verdict_data.get("categories"))
                if verdict_data.get("malicious") is True:
                    verdict = "malicious"
                elif verdict_data.get("malicious") is False:
                    verdict = "no_detection"
        limitations = ["Hasil pencarian arsip publik. Verdict pada arsip hanya berlaku untuk pemindaian historis tersebut."]
        page = record.get("page")
        if isinstance(page, dict) and isinstance(page.get("url"), str):
            try:
                final = parse_url(page["url"])
                if final.hostname != parse_url(task["url"]).hostname:
                    limitations.append("Arsip mencatat tujuan akhir dengan hostname berbeda.")
            except ValueError:
                limitations.append("Tujuan akhir pada arsip tidak dapat diverifikasi.")
        return ProviderCheck(
            provider="urlscan.io", status="found", specificity=specificity, observed_at=observed,
            freshness=freshness(observed), verdict=verdict, categories=categories, record_id=record_id,
            limitations=limitations,
        )


class DomainIntelligence:
    def __init__(self, client: httpx.AsyncClient):
        self.dns = ReadOnlyLookup(client, "DNS", minute=12, daily=1000)
        self.rdap = ReadOnlyLookup(client, "RDAP", minute=6)

    async def lookup_dns(self, domain: str):
        records = await asyncio.gather(*(
            self.dns.get(DNS, domain + record_type, self.parse_dns,
                         params={"name": domain, "type": record_type, "edns_client_subnet": "0.0.0.0/0"},
                         headers={"Accept": "application/dns-json"})
            for record_type in ("A", "AAAA")
        ))
        found = [record for record in records if record.status == "found"]
        if not found:
            return next((record for record in records if record.status != "not_found"), records[0])
        complete = all(record.status in {"found", "not_found"} for record in records)
        details = list(dict.fromkeys(item for record in found for item in record.details))[:12]
        notes = list(dict.fromkeys(item for record in found for item in record.limitations))
        if not complete:
            notes.append("Resolusi A atau AAAA belum lengkap.")
        return ProviderCheck(provider="DNS", status="found", details=details, limitations=notes,
                             observed_at=min(record.observed_at for record in found))

    @staticmethod
    def parse_dns(payload):
        code = payload["Status"]
        if code == 3:
            return ProviderCheck(provider="DNS", status="not_found")
        if type(code) is not int or code != 0 or payload.get("TC") is True:
            return ProviderCheck(provider="DNS", status="unavailable")
        details = []
        notes = []
        answer = payload.get("Answer", [])
        if not isinstance(answer, list):
            raise ValueError("Invalid DNS answers")
        for record in answer:
            kind, value = record["type"], record["data"]
            if kind in {1, 28}:
                address = ip_address(value)
                checked = (address.ipv4_mapped or address) if isinstance(address, IPv6Address) else address
                if checked.is_global and not checked.is_multicast:
                    details.append(f'{"A" if address.version == 4 else "AAAA"} {address}')
                elif not notes:
                    notes.append("Resolver mengembalikan alamat nonpublik.")
            elif kind == 5 and isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9.-]{1,140}", value):
                try:
                    canonical = parse_url("https://" + value)
                    if canonical.registered_domain:
                        details.append("CNAME " + canonical.hostname)
                except ValueError:
                    continue
        return ProviderCheck(provider="DNS", status="found" if details or notes else "not_found",
                             observed_at=datetime.now(UTC), details=details[:12], limitations=notes)

    async def lookup_rdap(self, domain: str):
        endpoint = RDAP.get(domain.rsplit(".", 1)[-1])
        if endpoint is None:
            return ProviderCheck(provider="RDAP", status="skipped", limitations=["RDAP saat ini tersedia untuk .com dan .net."])
        return await self.rdap.get(endpoint + domain, domain, lambda payload: self.parse_rdap(payload, domain))

    @staticmethod
    def parse_rdap(payload, domain):
        if payload.get("objectClassName") != "domain" or str(payload.get("ldhName", "")).lower().rstrip(".") != domain:
            raise ValueError("RDAP domain mismatch")
        details = []
        for event in payload.get("events", []):
            action = {"registration": "Terdaftar", "expiration": "Kedaluwarsa"}.get(event.get("eventAction"))
            date = timestamp(event.get("eventDate"))
            if action and date:
                details.append(f"{action} {date.date().isoformat()}")
        for entity in payload.get("entities", []):
            if "registrar" not in entity.get("roles", []):
                continue
            public_ids = entity.get("publicIds", [])
            for item in public_ids:
                identifier = item.get("identifier")
                if item.get("type") == "IANA Registrar ID" and isinstance(identifier, str) and re.fullmatch(r"[0-9]{1,12}", identifier):
                    details.append("ID registrar IANA " + identifier)
        for status in safe_categories(payload.get("status")):
            details.append("Status " + status)
        return ProviderCheck(provider="RDAP", status="found", details=list(dict.fromkeys(details))[:12],
                             observed_at=datetime.now(UTC), limitations=["Metadata registrasi tidak menentukan keamanan website."])
