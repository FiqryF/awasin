import asyncio
from base64 import urlsafe_b64encode
from datetime import UTC, datetime
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.analysis.historical import DomainIntelligence, Urlscan, VirusTotal
from app.modules.analysis.inspect_url import UrlInspector, domain_identity
from app.modules.analysis.registry import load_registry
from app.modules.analysis.url import Lookup, parse_url


def vt_report(malicious=3, date=None):
    return {"data": {"type": "url", "attributes": {
        "last_analysis_stats": {"malicious": malicious, "suspicious": 0, "undetected": 60},
        "last_analysis_date": date if date is not None else int(datetime.now(UTC).timestamp()),
        "categories": {"example": "test category"},
    }}}


@pytest.mark.parametrize(("status", "expected"), [
    (200, "found"), (404, "not_found"), (401, "unauthorized"), (403, "unauthorized"),
    (429, "rate_limited"), (503, "unavailable"), (302, "unavailable"), (None, "timeout"),
])
def test_vt_read_only_status_and_cache(status, expected):
    requests = []

    def transport(request):
        requests.append(request)
        assert request.method == "GET" and request.url.host == "www.virustotal.com"
        assert request.headers["x-apikey"] == "vt-mock"
        identifier = urlsafe_b64encode(b"https://example.com/").decode().rstrip("=")
        assert request.url.path == f"/api/v3/urls/{identifier}" and not request.url.query
        if status is None:
            raise httpx.ReadTimeout("fixture", request=request)
        return httpx.Response(status, json=vt_report(), headers={"Location": "https://example.invalid/"})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport), follow_redirects=True) as client:
            adapter = VirusTotal(client, "vt-mock")
            for raw in ("https://example.com/?fixture=secret", "https://example.com/private", "https://one.example.com/", "example.com"):
                assert (await adapter.lookup(parse_url(raw, allow_domain=True))).status == "skipped"
            target = parse_url("https://example.com")
            result = await adapter.lookup(target)
            assert result.status == expected
            if status == 200:
                assert result.verdict == "malicious" and result.counts["malicious"] == 3
                assert result.freshness == "recent"
            if status in {200, 404, 429}:
                assert (await adapter.lookup(target)).status == expected
            assert len(requests) == 1

    asyncio.run(run())


def archive(url, *, visibility="public"):
    return {"task": {"url": url, "time": "2022-04-01T08:00:00Z", "visibility": visibility,
                     "uuid": "d52704b4-4077-4daf-ae7b-8b1faac91821"},
            "verdicts": {"overall": {"malicious": True, "categories": ["phishing"]}}}


@pytest.mark.parametrize(("status", "rows", "expected", "specificity"), [
    (200, [archive("https://example.com/old"), archive("https://example.com/")], "found", "exact_url"),
    (200, [archive("https://example.com/old")], "found", "hostname"),
    (200, [archive("https://sub.example.com/")], "found", "related_domain"),
    (200, [archive("https://other.example.org/"), archive("https://example.com/", visibility="unlisted")], "not_found", None),
    (200, [], "not_found", None), (500, [], "unavailable", None), (429, [], "rate_limited", None),
])
def test_urlscan_public_history(status, rows, expected, specificity):
    def transport(request):
        assert request.method == "GET" and request.url.host == "urlscan.io" and request.url.path == "/api/v1/search"
        assert request.headers["api-key"] == "us-mock"
        assert request.url.params["q"] == '(page.apexDomain:"example.com" OR task.apexDomain:"example.com") AND task.visibility:public'
        return httpx.Response(status, json={"results": rows})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            result = await Urlscan(client, "us-mock").lookup(parse_url("https://example.com/"))
            assert result.status == expected and result.specificity == specificity
            if expected == "found":
                assert result.freshness == "stale" and result.verdict == "malicious"
                assert result.categories == ["phishing"]

    asyncio.run(run())


class GoogleNoMatch:
    name = "Google Safe Browsing"

    async def lookup_url(self, _target):
        return Lookup("no_match", datetime.now(UTC))


@pytest.mark.parametrize(("dns_value", "vt_status", "expected_risk"), [
    ("93.184.216.34", 200, "medium"), ("93.184.216.34", 503, "unknown"),
    ("10.0.0.1", 200, "unknown"),
])
def test_isolated_failures_conflict_and_dns_privacy(dns_value, vt_status, expected_risk):
    calls = []

    def transport(request):
        assert request.method == "GET"
        host = request.url.host
        calls.append(host)
        if host == "dns.google":
            records = [{"type": 1, "data": dns_value}] if request.url.params["type"] == "A" else []
            return httpx.Response(200, json={"Status": 0, "Answer": records})
        if host == "rdap.verisign.com":
            return httpx.Response(503)
        if host == "www.virustotal.com":
            return httpx.Response(vt_status, json=vt_report())
        assert host == "urlscan.io"
        return httpx.Response(200, json={"results": [archive("https://other.example.com/")]})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            engine = UrlInspector(GoogleNoMatch(), virustotal=VirusTotal(client, "vt-mock"),
                                  urlscan=Urlscan(client, "us-mock"), domain_intelligence=DomainIntelligence(client))
            target = parse_url("https://example.com/")
            offline = await engine.inspect(target)
            assert all(check.status == "skipped" for check in offline.url_report.supplementary_checks)
            assert calls == []
            result = await engine.inspect(target, True, True)
            assert result.risk == expected_risk and result.url_report.threat_status == "no_match"
            checks = {check.provider: check for check in result.url_report.supplementary_checks}
            assert checks["RDAP"].status == "unavailable"
            if dns_value.startswith("10."):
                assert checks["DNS"].details == [] and checks["DNS"].limitations
                assert not {"www.virustotal.com", "urlscan.io"}.intersection(calls)
            else:
                assert checks["urlscan.io"].specificity == "related_domain"
            if expected_risk == "medium":
                assert any("hasil berbeda" in note for note in result.limitations)
                assert [e.source for e in result.evidence] == ["VirusTotal"]

    asyncio.run(run())


def test_rdap_exposes_only_public_domain_metadata():
    result = DomainIntelligence.parse_rdap({
        "objectClassName": "domain", "ldhName": "EXAMPLE.COM", "status": ["active"],
        "events": [{"eventAction": "registration", "eventDate": "2020-01-01T00:00:00Z"}],
        "entities": [{"roles": ["registrant"], "vcardArray": ["private-fixture"]}],
    }, "example.com")
    assert result.details == ["Terdaftar 2020-01-01", "Status active"]
    assert "private-fixture" not in result.model_dump_json()


def test_only_verified_registry_rows_and_controlled_typos(tmp_path):
    snapshot = tmp_path / "registry.json"
    snapshot.write_text(json.dumps([
        {"status": "candidate", "domain": "example.net"},
        {"status": "verified", "organization_name": "Example", "domain": "example.org", "alias": "example",
         "evidence_url": "https://example.org/about", "verified_at": "2026-01-01T12:00:00Z"},
    ]), encoding="utf-8")
    references = load_registry(snapshot)
    assert domain_identity(parse_url("https://login.example.org/"), references)[0] == "reference_match"
    assert domain_identity(parse_url("https://examlpe.com/"), references)[0] == "near_spelling"
    assert domain_identity(parse_url("https://exampletutorials.com/"), references)[0] == "insufficient_evidence"
    assert domain_identity(parse_url("https://example.net/"), references)[0] == "brand_reference"


def test_enhanced_consent_is_strict_and_opt_in(settings):
    with TestClient(create_app(settings)) as client:
        url = "/api/v1/analysis"
        for mode in ("link", "website"):
            payload = {"mode": mode, "url": "https://example.com/"}
            report = client.post(url, json=payload).json()["url_report"]
            assert all(check["status"] == "skipped" for check in report["supplementary_checks"])
            response = client.post(url, json={**payload, "enhanced_lookup_consent": "true"})
            assert response.status_code == 422
