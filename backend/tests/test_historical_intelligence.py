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
from app.modules.analysis.schemas import ProviderCheck


def vt_report(malicious=3, date=None):
    return {"data": {"type": "url", "attributes": {
        "last_analysis_stats": {"malicious": malicious, "suspicious": 0, "undetected": 60},
        "last_analysis_date": date if date is not None else int(datetime.now(UTC).timestamp()),
        "categories": {"example": "test category"},
    }}}


def test_virustotal_unrated_engines_do_not_produce_a_clean_verdict():
    payload = vt_report(malicious=0)
    attributes = payload["data"]["attributes"]
    attributes["last_analysis_results"] = {"one": {}, "two": {}}
    result = VirusTotal.parse(payload)
    assert result.verdict == "unknown" and result.engine_count == 2
    attributes["last_analysis_stats"]["harmless"] = 1
    assert VirusTotal.parse(payload).verdict == "no_detection"


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
        identifier = urlsafe_b64encode(b"https://www.example.com/docs").decode().rstrip("=")
        assert request.url.path == f"/api/v3/urls/{identifier}" and not request.url.query
        if status is None:
            raise httpx.ReadTimeout("fixture", request=request)
        return httpx.Response(status, json=vt_report(), headers={"Location": "https://example.invalid/"})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport), follow_redirects=True) as client:
            adapter = VirusTotal(client, "vt-mock")
            for raw in ("https://example.com/?fixture=secret", "https://example.com/private", "https://one.example.com/reset-password/code", "example.com"):
                assert (await adapter.lookup(parse_url(raw, allow_domain=True))).status == "skipped"
            target = parse_url("https://www.example.com/docs")
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
        assert request.url.params["q"] in {
            'task.url.keyword:"https://example.com/" AND task.visibility:public',
            '(page.apexDomain:"example.com" OR task.apexDomain:"example.com") AND task.visibility:public',
        }
        return httpx.Response(status, json={"results": rows})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            result = await Urlscan(client, "us-mock").lookup(parse_url("https://example.com/"))
            assert result.status == expected and result.specificity == specificity
            if expected == "found":
                assert result.freshness == "stale" and result.verdict == "malicious"
                assert result.categories == ["phishing"]

    asyncio.run(run())


def test_urlscan_loads_exact_public_archive_verdict_by_uuid():
    record = archive("https://example.com/docs")
    record_id = record["task"]["uuid"]
    calls = []

    def transport(request):
        calls.append(request.url.path)
        assert request.method == "GET" and request.url.host == "urlscan.io"
        if request.url.path == "/api/v1/search":
            assert request.url.params["q"] == 'task.url.keyword:"https://example.com/docs" AND task.visibility:public'
            return httpx.Response(200, json={"results": [{"task": record["task"]}]})
        assert request.url.path == f"/api/v1/result/{record_id}/"
        return httpx.Response(200, json=record)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            result = await Urlscan(client, "fixture").lookup(parse_url("https://example.com/docs"))
            assert (result.status, result.specificity, result.verdict) == ("found", "exact_url", "malicious")
        assert calls == ["/api/v1/search", f"/api/v1/result/{record_id}/"]

    asyncio.run(run())


def test_dns_failure_allows_domain_only_urlscan_without_sending_path():
    calls = []

    def transport(request):
        calls.append(request.url.host)
        if request.url.host == "dns.google":
            assert request.url.params["name"] == "www.example.com"
            raise httpx.ReadTimeout("fixture", request=request)
        if request.url.host == "rdap.verisign.com":
            return httpx.Response(404)
        assert request.url.host == "urlscan.io"
        assert request.url.params["q"] == '(page.apexDomain:"example.com" OR task.apexDomain:"example.com") AND task.visibility:public'
        return httpx.Response(200, json={"results": []})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            inspector = UrlInspector(virustotal=VirusTotal(client, "fixture"), urlscan=Urlscan(client, "fixture"),
                                     domain_intelligence=DomainIntelligence(client))
            report = (await inspector.inspect(parse_url("https://www.example.com/docs"), enhanced_consent=True)).url_report
            checks = {check.provider: check.status for check in report.supplementary_checks}
            assert checks["VirusTotal"] == "skipped" and checks["urlscan.io"] == "not_found"
            assert "www.virustotal.com" not in calls

    asyncio.run(run())


class GoogleNoMatch:
    name = "Google Safe Browsing"

    async def lookup_url(self, _target):
        return Lookup("no_match", datetime.now(UTC))


def test_public_download_search_targets_file_url_and_rejects_other_paths():
    url = "https://example.org/releases/download.zip"
    target = parse_url(url)
    calls = []

    def transport(request):
        query = request.url.params["q"]
        calls.append(query)
        assert query.startswith(f'files.url:"{url}" AND ')
        return httpx.Response(200, json={"results": [{
            "task": {"time": datetime.now(UTC).isoformat(), "visibility": "public"},
            "files": [
                {"url": url + ".old", "sha256": "b" * 64, "state": "completed"},
                {"url": url, "sha256": "a" * 64, "state": "completed"},
            ],
        }]})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            result = await Urlscan(client, "fixture").lookup_download(target)
        assert result.status == "found" and result.record_id == "a" * 64
        assert len(calls) == 1

    asyncio.run(run())


@pytest.mark.parametrize(("archived_suffix", "file_status", "malicious", "harmless", "stale", "expected_status", "expected_risk"), [
    ("?version=1", 200, 3, 0, False, "found", "medium"),
    ("?version=1", 200, 0, 50, False, "found", "low"),
    ("?version=1", 200, 0, 0, False, "found", "unknown"),
    ("?version=1", 200, 0, 50, True, "found", "unknown"),
    ("?version=1", 200, 1, 50, False, "found", "unknown"),
    ("?version=2", 200, 3, 0, False, "not_found", "unknown"),
    ("?version=1", 404, 3, 0, False, "not_found", "unknown"),
])
def test_download_hash_lookup_requires_the_exact_archived_url(
    archived_suffix, file_status, malicious, harmless, stale, expected_status, expected_risk,
):
    url = "https://example.org/download.zip"
    file_hash = "a" * 64
    calls = []

    def transport(request):
        assert request.method == "GET"
        assert "version" not in str(request.url)
        host = request.url.host
        calls.append(host)
        if host == "dns.google":
            return httpx.Response(200, json={"Status": 0, "Answer": [{"type": 1, "data": "93.184.216.34"}]})
        if host == "urlscan.io":
            assert request.url.path == "/api/v1/search"
            if "files.sha256:*" not in request.url.params["q"]:
                return httpx.Response(200, json={"results": []})
            return httpx.Response(200, json={"results": [{
                "task": {"time": datetime.now(UTC).isoformat(), "visibility": "public"},
                "files": [{"url": url + archived_suffix, "sha256": file_hash, "state": "completed"}],
            }]})
        assert host == "www.virustotal.com" and request.url.path == f"/api/v3/files/{file_hash}"
        report = vt_report(malicious, date=1 if stale else None)
        report["data"].update(type="file", id=file_hash)
        report["data"]["attributes"]["last_analysis_stats"]["harmless"] = harmless
        return httpx.Response(file_status, json=report)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            inspector = UrlInspector(GoogleNoMatch(), virustotal=VirusTotal(client, "fixture"),
                                     urlscan=Urlscan(client, "fixture"), domain_intelligence=DomainIntelligence(client))
            target = parse_url(url + "?version=1")
            await inspector.inspect(target)
            assert calls == []
            result = await inspector.inspect(target, True, True)
        check = next(item for item in result.url_report.supplementary_checks if item.provider == "VirusTotal File")
        assert (check.status, result.risk) == (expected_status, expected_risk)
        assert result.url_report.identity_status == "insufficient_evidence"
        assert calls.count("www.virustotal.com") == int(archived_suffix == "?version=1")
        assert file_hash not in result.model_dump_json()
        if expected_status == "found":
            assert check.archive_observed_at and check.observed_at and check.specificity == "file_hash"

    asyncio.run(run())


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


@pytest.mark.parametrize(("specificity", "age", "verdict", "lookup_status", "expected"), [
    ("exact_url", "recent", "no_detection", "no_match", "low"),
    ("hostname", "recent", "no_detection", "no_match", "unknown"),
    ("exact_url", "stale", "no_detection", "no_match", "unknown"),
    ("exact_url", "recent", "unknown", "no_match", "unknown"),
    ("exact_url", "recent", "no_detection", "timeout", "unknown"),
    ("exact_url", "recent", "no_detection", "match", "high"),
])
def test_unlisted_domain_risk_uses_url_specific_reputation(specificity, age, verdict, lookup_status, expected):
    class Provider(GoogleNoMatch):
        async def lookup_url(self, target):
            types = ("SOCIAL_ENGINEERING",) if lookup_status == "match" else ()
            return Lookup(lookup_status, datetime.now(UTC), types)

    class Inspector(UrlInspector):
        async def _supplementary(self, target, consent):
            return [ProviderCheck(provider="urlscan.io", status="found",
                                  observed_at=datetime.now(UTC),
                                  specificity=specificity, freshness=age, verdict=verdict)]

    result = asyncio.run(Inspector(Provider()).inspect(
        parse_url("https://docs.example.net/guide"), lookup_consent=True, enhanced_consent=True,
    ))
    assert result.risk == expected
    assert result.url_report.identity_status == "insufficient_evidence"
    if expected == "low":
        assert "URL yang sama" in result.explanation
        assert any(item.code == "threat_no_match" for item in result.evidence)


@pytest.mark.parametrize(("scope", "age", "expected"), [
    ("exact_url", "recent", "medium"),
    ("hostname", "recent", "unknown"),
    ("exact_url", "stale", "unknown"),
])
def test_two_recent_exact_url_archives_can_support_medium_risk(scope, age, expected):
    class Inspector(UrlInspector):
        async def _supplementary(self, target, consent):
            now = datetime.now(UTC)
            return [
                ProviderCheck(provider="VirusTotal", status="found", observed_at=now,
                              specificity="exact_url", freshness="recent", verdict="malicious", counts={"malicious": 1}),
                ProviderCheck(provider="urlscan.io", status="found", observed_at=now,
                              specificity=scope, freshness=age, verdict="suspicious"),
            ]

    result = asyncio.run(Inspector(GoogleNoMatch()).inspect(parse_url("https://example.org/download.zip"), True, True))
    assert result.risk == expected


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
