import asyncio
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.analysis.inspect_url import UrlInspector, domain_identity, single_edit
from app.modules.analysis.url import parse_url
from app.modules.analysis.web_risk import ENDPOINT, WebRisk

API = "/api/v1/analysis"


@pytest.mark.parametrize("url, code", [
    ("https://bca.co.id.example.org/login", "misleading_subdomain"),
    ("https://bса.org", "confusable"),
    ("https://www.bn1.co.id/", "confusable"),
    ("https://bankindonesi.org", "near_spelling"),
    ("https://example.org/login", "account_path"),
    ("https://one.two.three.example.org/", "deep_subdomains"),
    ("https://example.org:8443/", "nonstandard_port"),
    ("https://1.1.1.1/", "ip_literal"),
    ("https://example.org/?next=https%3A%2F%2Fexample.net", "redirect_parameter"),
    ("https://example.org/" + "a" * 260, "long_url"),
])
def test_offline_indicators(url, code):
    target = parse_url(url)
    result = asyncio.run(UrlInspector().inspect(target))
    assert code in {e.code for e in result.evidence}
    assert result.url_report.threat_status == "not_requested"
    assert result.risk in {"unknown", "medium"}


def test_punycode_is_same_signal_as_unicode():
    unicode = parse_url("https://bса.org")
    assert unicode.hostname.startswith("xn--")
    result = asyncio.run(UrlInspector().inspect(parse_url("https://" + unicode.hostname)))
    assert result.risk == "medium"
    assert result.evidence[0].code == "confusable"


def test_unicode_table_detects_non_ascii_domain_impersonation_for_registry_entries():
    reference = ("Example", "example.com", "example", "https://example.com/")
    assert domain_identity(parse_url("https://bücher.de/"), (reference,))[0] == "insufficient_evidence"
    web = ("Web Example", "webexample.com", "webexample", "https://webexample.com/")
    assert domain_identity(parse_url("https://ԝebexample.org/"), (web,)) == ("confusable", web)


def test_digit_lookalike_applies_to_other_references():
    reference = ("Site", "site.example.org", "site", "https://site.example.org/")
    assert domain_identity(parse_url("https://s1te.net/"), (reference,)) == ("confusable", reference)
    assert domain_identity(parse_url("https://slte.net/"), (reference,))[0] == "insufficient_evidence"
    assert domain_identity(parse_url("https://site.example.org/"), (reference,))[0] == "reference_match"


@pytest.mark.parametrize(("url", "status", "expected_codes"), [
    ("https://docs.example.org/account/login?next=https%3A%2F%2Flogin.example.org%2Fhome",
     "inconclusive", {"account_path", "encoded_components"}),
    ("https://example.org/?next=%2Fdocs%2Fguide", "inconclusive", {"encoded_components"}),
    ("https://example.org/?next=%252F%252Fexample.net%252Fdocs", "partial", {"redirect_parameter", "encoded_components"}),
    ("https://tenant-a.github.io/?next=//tenant-b.github.io/docs", "partial", {"redirect_parameter"}),
    ("https://example.org/?q=https://example.net/docs", "inconclusive", set()),
    ("https://example.org/?q=public%250A", "completed", {"encoded_controls"}),
    ("https://bücher.de/guide", "inconclusive", set()),
    ("https://日本語.jp/guide", "inconclusive", set()),
    ("https://dоcs.example.org/guide", "inconclusive", {"mixed_script_hostname"}),
])
def test_contextual_signals_and_redirect_scope(url, status, expected_codes):
    result = asyncio.run(UrlInspector().inspect(parse_url(url)))
    assert result.status == status
    assert result.risk == ("medium" if "encoded_controls" in expected_codes else "unknown")
    assert {item.code for item in result.evidence} == expected_codes


@pytest.mark.parametrize(("url", "expected_risk", "expected_codes"), [
    ("https://www.bca.co.id/id/individu", "low", {"reference_match"}),
    ("https://www.bni.co.id/id-id/", "low", {"reference_match"}),
    ("https://bca.co.id.example.org/login", "medium", {"misleading_subdomain", "account_path"}),
    ("https://login-bca.example.org/verify-account", "medium", {"brand_reference", "account_path"}),
    ("https://example.org/docs/getting-started", "unknown", set()),
    ("https://www.python.org/ftp/python/3.13.2/python-3.13.2-embed-amd64.zip", "unknown", {"archive_download"}),
    ("https://pulse.frozenneedlefishcodec1.lol/Download.zip", "unknown", {"archive_download"}),
    ("https://example.org/%EF%83%AD%C2%A0Download.zip?c=fixture", "medium",
     {"archive_download", "obscured_filename"}),
    ("https://example.org/Download%252ezip?next=https%3A%2F%2Fexample.net", "medium",
     {"archive_download", "redirect_parameter"}),
    ("https://1.1.1.1/setup.exe", "medium", {"ip_literal", "executable_download"}),
])
def test_risk_decision_uses_supported_evidence(url, expected_risk, expected_codes):
    from app.modules.analysis.url import Lookup

    class NoMatch:
        name = "Google Safe Browsing"

        async def lookup_url(self, target):
            return Lookup("no_match", datetime.now(UTC))

    result = asyncio.run(UrlInspector(NoMatch()).inspect(parse_url(url), lookup_consent=True))
    assert result.risk == expected_risk
    assert expected_codes <= {item.code for item in result.evidence}
    if expected_risk == "medium":
        assert any(item.severity == "medium" and item.validation == "verified" for item in result.evidence)


def test_identity_honors_private_suffix_boundaries_and_prioritizes_strong_evidence():
    tenant_boundary = (("Example operator", "amazonaws.com", "amazonaws", "https://aws.amazon.com/"),)
    assert domain_identity(parse_url("https://console.amazonaws.com/"), tenant_boundary)[0] == "reference_match"
    assert domain_identity(parse_url("https://demo.s3.amazonaws.com/"), tenant_boundary)[0] != "reference_match"
    references = (
        ("First", "first.example.net", "first", "https://first.example.net/"),
        ("Second", "second.example.org", "second", "https://second.example.org/"),
    )
    target = parse_url("https://first.second.example.org.example.com/")
    assert domain_identity(target, references) == ("misleading_subdomain", references[1])


@pytest.mark.parametrize(("word", "expected"), [
    ("registry", False), ("regsitry", True), ("regstry", True), ("registrys", True),
    ("regxstry", True), ("rgisetry", False), ("reg", False),
])
def test_bounded_domain_edit_distance(word, expected):
    assert single_edit("registry", word) is expected


def test_both_api_modes_run_same_engine_and_redact_url(settings):
    url = "https://bca.co.id.example.org/login?marker=private-fixture"
    with TestClient(create_app(settings)) as client:
        results = []
        for mode in ("link", "website"):
            response = client.post(API, json={"mode": mode, "url": url, "threat_lookup_consent": True})
            assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
            assert "private-fixture" not in response.text
            data = response.json()
            assert data["mode"] == mode and data["history_eligible"] is False
            assert data["status"] == "completed" and data["risk"] == "medium"
            assert data["url_report"]["registered_domain"] == "example.org"
            assert data["url_report"]["display_url"] == "https://bca.co.id.example.org"
            assert data["url_report"]["components_hidden"]
            results.append({e["code"] for e in data["evidence"]})
        assert results[0] == results[1]
        bare = client.post(API, json={"mode": "website", "url": "example.org"}).json()
        assert bare["url_report"]["scheme_assumed"] and bare["risk"] == "unknown"
        official = client.post(API, json={"mode": "link", "url": "https://www.bca.co.id"}).json()
        assert official["url_report"]["identity_status"] == "reference_match"
        assert official["risk"] == "unknown"


@pytest.mark.parametrize("http_status, body, expected", [
    (200, {}, "no_match"),
    (429, {}, "rate_limited"),
    (503, {}, "unavailable"),
    (302, {}, "unavailable"),
    (200, {"unexpected": "value"}, "invalid_response"),
])
def test_mock_provider_failure_and_no_match(http_status, body, expected):
    def transport(request):
        assert str(request.url.copy_with(query=None)) == ENDPOINT
        assert request.headers["x-goog-api-key"] == "mock-fixture"
        assert request.url.params["uri"] == "https://example.org/"
        return httpx.Response(http_status, json=body, headers={"Location": "https://example.invalid/"})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport), follow_redirects=True) as client:
            engine = UrlInspector(WebRisk(client, "mock-fixture"))
            result = await engine.inspect(parse_url("https://example.org/"), True)
            assert result.url_report.threat_status == expected
            assert result.risk == "unknown"

    asyncio.run(run())


def test_mock_match_cache_and_identity_does_not_override_threat():
    calls = 0

    def transport(_request):
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"threat": {
            "threatTypes": ["SOCIAL_ENGINEERING"], "expireTime": (datetime.now(UTC) + timedelta(minutes=5)).isoformat(),
        }})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            engine = UrlInspector(WebRisk(client, "mock-fixture"))
            target = parse_url("https://www.bca.co.id/")
            for _ in range(2):
                result = await engine.inspect(target, True)
                assert result.risk == "high" and result.url_report.threat_status == "match"
                assert result.url_report.identity_status == "reference_match"
                assert any(e.code == "threat_match" and e.validation == "verified" for e in result.evidence)
            assert calls == 1
            assert (await engine.inspect(target)).url_report.threat_status == "not_requested"
            for url in ("https://example.org/?secret=fixture", "https://1.1.1.1/", "example.org"):
                assert (await engine.inspect(parse_url(url, allow_domain=True), True)).url_report.threat_status == "unsupported"
            assert calls == 1

    asyncio.run(run())


def test_mock_provider_timeout_and_local_evidence():
    def transport(request):
        raise httpx.ReadTimeout("fixture", request=request)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            engine = UrlInspector(WebRisk(client, "mock-fixture"))
            result = await engine.inspect(parse_url("https://example.org/login"), True)
            assert result.url_report.threat_status == "timeout"
            assert {e.code for e in result.evidence} == {"account_path"}

    asyncio.run(run())
