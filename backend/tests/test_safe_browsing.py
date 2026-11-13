import asyncio
from base64 import b64decode, b64encode
from hashlib import sha256

import httpx
import pytest

from app.modules.analysis.inspect_url import UrlInspector
from app.modules.analysis.safe_browsing import ENDPOINT, SafeBrowsing, url_hashes
from app.modules.analysis.safe_browsing_proto import SearchHashesResponse
from app.modules.analysis.url import parse_url


def test_v5_expressions_use_registered_domain_and_normalized_path():
    target = parse_url("https://a.b.example.co.uk:8443/one/%252e%252e/two//file")
    expected = {
        sha256((host + path).encode()).digest()
        for host in ("example.co.uk", "b.example.co.uk", "a.b.example.co.uk")
        for path in ("/", "/two/", "/two/file")
    }
    assert url_hashes(target) == expected


@pytest.mark.parametrize("variant, expected", [
    ("match", "match"), ("collision", "no_match"), ("empty", "no_match"),
    ("canary", "no_match"), ("unknown", "no_match"), ("rate_limit", "rate_limited"),
    ("timeout", "timeout"), ("server_error", "unavailable"),
    ("redirect", "unavailable"), ("invalid", "invalid_response"),
])
def test_safe_browsing_lookup_and_fallback(variant, expected):
    calls = 0
    target = parse_url("example.com/login?label=%2523fragment", allow_domain=True)
    digest = sha256(b"example.com/login?label=%23fragment").digest()

    def transport(request):
        nonlocal calls
        calls += 1
        assert str(request.url.copy_with(query=None)) == ENDPOINT
        assert request.headers["x-goog-api-key"] == "mock-key"
        assert not request.content
        assert "fragment" not in str(request.url)
        assert {name for name, _ in request.url.params.multi_items()} == {"hashPrefixes"}
        assert {b64decode(value) for value in request.url.params.get_list("hashPrefixes")} == {
            item[:4] for item in url_hashes(target)
        }
        if variant == "timeout":
            raise httpx.ReadTimeout("fixture", request=request)
        if variant in {"rate_limit", "server_error", "redirect"}:
            return httpx.Response(
                {"rate_limit": 429, "server_error": 503, "redirect": 302}[variant],
                headers={"Location": "https://example.invalid"},
            )
        if variant == "invalid":
            return httpx.Response(200, json={"cacheDuration": "invalid"})
        if variant == "empty":
            return httpx.Response(200, json={"cacheDuration": "30s"})
        candidate = digest[:-1] + bytes([digest[-1] ^ 1]) if variant == "collision" else digest
        return httpx.Response(200, json={
            "cacheDuration": "30s",
            "fullHashes": [{
                "fullHash": b64encode(candidate).decode(),
                "fullHashDetails": [{
                    "threatType": "FUTURE_THREAT" if variant == "unknown" else "SOCIAL_ENGINEERING",
                    "attributes": ["CANARY"] if variant == "canary" else [],
                }],
            }],
        })

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport), follow_redirects=True) as client:
            engine = UrlInspector(SafeBrowsing(client, "mock-key"))
            assert (await engine.inspect(target)).url_report.threat_status == "not_requested"
            assert calls == 0
            result = await engine.inspect(target, True)
            assert result.url_report.threat_provider == "Google Safe Browsing"
            assert result.url_report.threat_status == expected
            assert result.risk == ("high" if expected == "match" else "unknown")
            assert (result.url_report.threat_checked_at is not None) == (expected in {"match", "no_match"})
            assert any(item.code == "account_path" for item in result.evidence)
            assert "mock-key" not in result.model_dump_json()
            if expected in {"match", "no_match"}:
                assert (await engine.inspect(target, True)).url_report.threat_status == expected
            assert calls == 1

    asyncio.run(run())


@pytest.mark.parametrize("matched", [False, True])
def test_protobuf_response_from_google_wire_format(matched):
    digest = sha256(b"example.com/").digest()
    payload = SearchHashesResponse()
    payload.cache_duration.seconds = 60
    if matched:
        item = payload.full_hashes.add(full_hash=digest)
        item.full_hash_details.add(threat_type=2)
        item.full_hash_details.add(threat_type=1, attributes=[2])

    async def run():
        transport = httpx.MockTransport(lambda _: httpx.Response(
            200, content=payload.SerializeToString(), headers={"Content-Type": "application/x-protobuf"},
        ))
        async with httpx.AsyncClient(transport=transport) as client:
            result = await SafeBrowsing(client, "mock-key").lookup_url(parse_url("https://example.com"))
            assert result.status == ("match" if matched else "no_match")
            assert result.types == (("SOCIAL_ENGINEERING",) if matched else ())

    asyncio.run(run())
