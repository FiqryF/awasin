import asyncio
from collections import OrderedDict
from datetime import UTC, datetime
from hashlib import sha256
import hmac
import json
from secrets import token_bytes

import httpx

from .url import Lookup, UrlTarget

ENDPOINT = "https://webrisk.googleapis.com/v1/uris:search"
TYPES = ("SOCIAL_ENGINEERING", "MALWARE", "UNWANTED_SOFTWARE")
class WebRisk:
    name = "Google Web Risk"

    def __init__(self, client: httpx.AsyncClient, key: str):
        self.client, self.key = client, key
        self.salt = token_bytes(32)
        self.cache: OrderedDict[bytes, tuple[datetime, Lookup]] = OrderedDict()

    async def lookup_url(self, target: UrlTarget) -> Lookup:
        if target.scheme_assumed or "?" in target.normalized_url or target.is_ip or not target.registered_domain:
            return Lookup("unsupported")
        cache_key = hmac.digest(self.salt, target.normalized_url.encode(), sha256)
        cached = self.cache.pop(cache_key, None)
        if cached and cached[0] > datetime.now(UTC):
            self.cache[cache_key] = cached
            return cached[1]
        params = [("uri", target.normalized_url), *(("threatTypes", item) for item in TYPES)]
        try:
            async with asyncio.timeout(2), self.client.stream(
                "GET", ENDPOINT, params=params, headers={"x-goog-api-key": self.key, "Accept-Encoding": "identity"},
                follow_redirects=False,
            ) as response:
                if response.status_code == 429:
                    return Lookup("rate_limited")
                if response.status_code != 200:
                    return Lookup("unavailable")
                body = bytearray()
                async for chunk in response.aiter_bytes(chunk_size=4096):
                    body.extend(chunk)
                    if len(body) > 16384:
                        return Lookup("invalid_response")
        except (TimeoutError, httpx.TimeoutException):
            return Lookup("timeout")
        except httpx.HTTPError:
            return Lookup("unavailable")

        now = datetime.now(UTC)
        try:
            payload = json.loads(body)
            if payload == {}:
                return Lookup("no_match", now)
            threat = payload["threat"]
            types = threat["threatTypes"]
            expiry = datetime.fromisoformat(threat["expireTime"])
            if not isinstance(types, list) or not types or any(item not in TYPES for item in types):
                return Lookup("invalid_response")
            if expiry.tzinfo is None or expiry <= now:
                return Lookup("invalid_response")
        except (ValueError, TypeError, KeyError, RecursionError):
            return Lookup("invalid_response")
        result = Lookup("match", now, tuple(dict.fromkeys(types)))
        self.cache[cache_key] = (expiry, result)
        if len(self.cache) > 512:
            self.cache.popitem(last=False)
        return result
