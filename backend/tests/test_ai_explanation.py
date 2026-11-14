import asyncio
import json
from datetime import UTC, datetime
from uuid import UUID

import pytest
import httpx
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.analysis import ai_tickets
from app.modules.analysis.ai_tickets import Binding, ExplanationTickets
from app.modules.analysis.ai_validator import render_choices
from app.modules.analysis.ai_analyst import AnalystEvidence, AnalystInput, SecurityAnalyst, UrlAnalystInput, minimize_evidence
from app.modules.analysis.mistral import InvalidAnalystResponse, MistralHTTPError
from app.modules.analysis.inspect_url import UrlInspector
from app.modules.analysis.router import optional_identity
from app.modules.analysis.url import Lookup, parse_url
from app.modules.analysis.schemas import ProviderCheck
from app.modules.identity.service import Identity
from pydantic import SecretStr, ValidationError
from app.modules.identity.service import IdentityService
from starlette.requests import Request

API = "/api/v1/analysis"


def evidence(id, source, code, status, **details):
    return AnalystEvidence(id=id, source=source, code=code, status=status, **details)


def assessment():
    return AnalystInput(risk="unknown", status="partial", evidence=[
        evidence("EV-001", "google_safe_browsing", "threat_lookup", "no_match"),
        evidence("EV-002", "virustotal", "supplementary_lookup", "found",
                 scope="related_domain", freshness="stale", historical_verdict="malicious"),
        evidence("EV-003", "urlscan", "supplementary_lookup", "skipped"),
        evidence("EV-004", "dns", "supplementary_lookup", "timeout"),
        evidence("EV-005", "url_structure", "account_path", "observed"),
    ])


def proposal(*claims, **extra):
    return json.dumps({"findings": [{"claim_type": kind, "evidence_ids": refs} for kind, refs in claims],
                       "recommendations": ["verify_official_source"], **extra})


@pytest.mark.parametrize(("url", "provider_status", "proposal_risk", "final_risk"), [
    ("https://www.bca.co.id/id/individu", "no_match", "low", "low"),
    ("https://bca.co.id.example.org/login", "no_match", "medium", "medium"),
    ("https://example.org/%EF%83%AD%C2%A0Download.zip", "no_match", "medium", "medium"),
    ("https://testsafebrowsing.appspot.com/s/malware.html", "match", "high", "high"),
    ("https://example.org/docs", "timeout", "unknown", "unknown"),
    ("https://example.org/docs", "no_match", "low", "low"),
])
def test_mistral_url_analysis_reconciles_provider_evidence(url, provider_status, proposal_risk, final_risk):
    class LookupFixture:
        name = "Google Safe Browsing"

        async def lookup_url(self, target):
            return Lookup(provider_status, types=("MALWARE",) if provider_status == "match" else ())

    class CitingAnalyst(Fake):
        async def generate(self, **args):
            self.calls.append(args)
            required = {"high": "threat_lookup", "low": "reference_match"}.get(proposal_risk)
            refs = [item["id"] for item in json.loads(args["payload"])["evidence"]
                    if item["code"] == required or (proposal_risk == "medium" and item.get("severity") == "medium")]
            return url_proposal(proposal_risk, refs)

    fake = CitingAnalyst()
    with client_for(fake) as client:
        wire(client, fake)
        client.app.app.state.analysis.adapters["link"] = UrlInspector(LookupFixture())
        scan = client.post(API, json={"mode": "link", "url": url, "url_ai_consent": True,
                                     "threat_lookup_consent": True, "detector_consent": True}).json()
        assert scan["detector"] is None and not fake.calls
        ticket = scan["ai"]["ticket"]
        response = client.post(f"{API}/explanation", json={"ticket": ticket, "consent": True}).json()
        assert response["status"] == "completed" and response["risk"] == final_risk
        assert response["recommendations"]
        sent = json.loads(fake.calls[0]["payload"])
        assert sent["url"] == ("https://example.org/[redacted]" if url.endswith("Download.zip") else url)
        assert "risk" not in sent and "status" not in sent


def test_url_sharing_requires_explicit_consent_and_redacts_secrets():
    fake = Fake(url_proposal("unknown"))
    with client_for(fake) as client:
        wire(client, fake)
        data = {"mode": "link", "url": "https://example.org/reset-password/private-key?token=query-secret#private-fragment"}
        assert client.post(API, json=data).json()["ai"] is None
        assert client.post(API, json={**data, "url_ai_consent": "true"}).status_code == 422
        scan = client.post(API, json={**data, "url_ai_consent": True}).json()
        ticket = scan["ai"]["ticket"]
        assert client.post(f"{API}/explanation", json={"ticket": ticket, "consent": False}).json()["status"] == "not_requested"
        assert not fake.calls
        assert client.post(f"{API}/explanation", json={"ticket": ticket, "consent": True}).json()["status"] == "completed"
        assert json.loads(fake.calls[0]["payload"])["url"] == "https://example.org/reset-password/[redacted]"


def url_proposal(risk, refs=()):
    return json.dumps({"risk": risk, "evidence_ids": list(refs), "recommendations": ["verify_official_source"]})


def test_mistral_sets_medium_or_high_from_cited_indicators_independent_of_local_risk():
    context = UrlAnalystInput(**assessment().model_dump(), url="https://example.org/login", registered_domain="example.org")
    with pytest.raises(InvalidAnalystResponse, match="cited risk indicator"):
        render_choices(url_proposal("medium", ["EV-005"]), context)
    context.evidence.append(evidence("EV-006", "domain_reference", "misleading_subdomain", "observed"))
    assert render_choices(url_proposal("high", ["EV-006"]), context).risk == "high"
    context.evidence.append(evidence("EV-007", "url_structure", "obscured_filename", "observed", severity="medium"))
    assert render_choices(url_proposal("medium", ["EV-007"]), context).risk == "medium"
    context.risk = "medium"
    with pytest.raises(InvalidAnalystResponse):
        render_choices(url_proposal("low"), context)
    with pytest.raises(InvalidAnalystResponse, match="cited risk indicator"):
        render_choices(url_proposal("medium", ["EV-001"]), context)
    with pytest.raises(InvalidAnalystResponse):
        render_choices(url_proposal("high"), context)
    assert render_choices(url_proposal("unknown"), context).risk == "unknown"

    context.evidence[0].status = "match"
    for risk in ("low", "medium"):
        with pytest.raises(InvalidAnalystResponse):
            render_choices(url_proposal(risk), context)


def test_low_risk_can_be_assessed_without_a_known_domain_or_archive():
    context = UrlAnalystInput(**assessment().model_dump(), url="https://example.org/docs", registered_domain="example.org")
    assert render_choices(url_proposal("low", ["EV-001"]), context).risk == "low"
    context.evidence.append(evidence("EV-006", "domain_reference", "misleading_subdomain", "observed"))
    with pytest.raises(InvalidAnalystResponse, match="contradicts strong evidence"):
        render_choices(url_proposal("low", ["EV-001"]), context)


def test_weak_virustotal_archive_requires_verification():
    context = UrlAnalystInput(**assessment().model_dump(), url="https://example.org/", registered_domain="example.org")
    archive = evidence("EV-006", "virustotal", "supplementary_lookup", "found",
                       scope="exact_url", freshness="recent", historical_verdict="malicious")
    context.evidence.append(archive)
    with pytest.raises(InvalidAnalystResponse, match="cited risk indicator"):
        render_choices(url_proposal("medium", [archive.id]), context)
    archive.severity = "medium"
    assert render_choices(url_proposal("medium", [archive.id]), context).risk == "medium"


@pytest.mark.parametrize(("different", "freshness"), [(False, "recent"), (True, "recent"), (False, "stale")])
def test_virus_total_family_retains_conflicts_and_counts_each_scan_once(different, freshness):
    report = asyncio.run(UrlInspector().inspect(parse_url("https://example.org/")))
    base = dict(status="found", specificity="exact_url", freshness=freshness, observed_at=datetime.now(UTC))
    reported = dict(verdict="malicious", counts={"malicious": 1, "suspicious": 1})
    classic = dict(verdict="no_detection", counts={"malicious": 0, "suspicious": 0, "harmless": 60}) if different else reported
    report.url_report.supplementary_checks = [
        ProviderCheck(provider="VirusTotal", **base, **classic),
        ProviderCheck(provider="VirusTotal AI", **base, **reported, engine_count=93),
    ]
    context = UrlAnalystInput(**minimize_evidence(report).model_dump(), url="https://example.org/", registered_domain="example.org")
    assert sum(item.source == "virustotal" for item in context.evidence) == different
    vtai = next(item for item in context.evidence if item.source == "vtai")
    assert vtai.counts == reported["counts"] and vtai.analysis_date and vtai.engine_count == 93
    assert render_choices(url_proposal("unknown", [vtai.id]), context).risk == "unknown"
    if freshness == "recent":
        result = render_choices(url_proposal("medium", [vtai.id]), context)
        assert result.risk == "medium" and "1 berbahaya, 1 mencurigakan" in result.findings[0].explanation
    else:
        with pytest.raises(InvalidAnalystResponse, match="cited risk indicator"):
            render_choices(url_proposal("medium", [vtai.id]), context)
    with pytest.raises(InvalidAnalystResponse, match="strong cited evidence"):
        render_choices(url_proposal("high", [vtai.id]), context)


@pytest.mark.parametrize(("primary", "consent", "backup_raw", "status", "analyst"), [
    (MistralHTTPError(429), True, url_proposal("unknown"), "completed", "nemotron"),
    (TimeoutError(), True, url_proposal("unknown"), "completed", "nemotron"),
    (url_proposal("high", ["EV-999"]), True, url_proposal("unknown"), "completed", "nemotron"),
    (TimeoutError(), False, url_proposal("unknown"), "timeout", None),
    (TimeoutError(), True, url_proposal("high", ["EV-999"]), "timeout", None),
    (MistralHTTPError(503), True, url_proposal("unknown"), "completed", "nemotron"),
    (url_proposal("unknown"), True, url_proposal("low"), "completed", "mistral"),
])
def test_nemotron_fallback_uses_consent_and_same_validation(primary, consent, backup_raw, status, analyst):
    fake, backup = Fake(primary), Fake(backup_raw)
    with client_for(fake) as client:
        wire(client, fake)
        state = client.app.app.state
        state.backup_analyst = SecurityAnalyst(state.settings, backup)
        data = {"mode": "link", "url": "https://example.org/reset-password/token-fixture?secret=fixture",
                "url_ai_consent": True, "openrouter_fallback_consent": consent}
        scan = client.post(API, json=data).json()
        result = client.post(f"{API}/explanation", json={"ticket": scan["ai"]["ticket"], "consent": True}).json()
        assert result["status"] == status and result.get("analyst") == analyst
        assert result["fallback_status"] == ("validation_failed" if consent and status == "timeout" else None)
        assert bool(backup.calls) == (consent and analyst != "mistral")
        if backup.calls:
            assert backup.calls[0]["payload"] == fake.calls[0]["payload"]
            payload = json.loads(backup.calls[0]["payload"])
            assert payload["url"] == "https://example.org/reset-password/[redacted]"
            assert "openrouter_fallback_consent" not in payload
            assert backup.calls[0]["schema"]["properties"]["risk"]["enum"] == ["low", "unknown"]


@pytest.mark.parametrize("code", ["account_path", "archive_download", "long_url", "deep_subdomains", "encoded_components"])
def test_common_url_traits_do_not_justify_high_risk(code):
    context = UrlAnalystInput(risk="unknown", status="inconclusive",
        url="https://example.org/docs", registered_domain="example.org",
        evidence=[evidence("EV-001", "url_structure", code, "observed")])
    with pytest.raises(InvalidAnalystResponse):
        render_choices(url_proposal("high", ["EV-001"]), context)


def test_templates_preserve_provider_scope_age_and_no_match_limits():
    result = render_choices(proposal(
        ("provider_no_match", ["EV-001"]), ("historical_report_context", ["EV-002"]),
        ("provider_unavailable", ["EV-004"]), ("url_structure_observation", ["EV-005"]),
    ), assessment())
    assert result.status == "completed"
    assert "Cakupan daftar terbatas" in result.findings[0].explanation
    assert "domain terkait" in result.findings[1].explanation and "Lebih dari 30 hari" in result.findings[1].explanation
    assert "belum memberikan hasil" in result.findings[2].explanation
    assert result.findings[3].source == "Struktur URL AWASIN"


def test_no_match_explanation_does_not_promise_a_safe_or_official_site():
    result = render_choices(proposal(("provider_no_match", ["EV-001"])), assessment())
    assert result.summary.startswith("Belum dapat dipastikan apakah tautan ini merupakan penipuan.")
    assert "Cakupan daftar terbatas" in result.findings[0].explanation
    assert "Cakupan daftar dan arsip tidak menjamin keamanan situs." in result.limitations


def test_mistral_explains_detector_assessment_without_overriding_high_risk():
    context = assessment().model_copy(update={"detector_verdict": "likely_legitimate"})
    raw = proposal(("provider_no_match", ["EV-001"]))
    assert "Belum dapat dipastikan" in render_choices(raw, context).summary
    context.risk = "high"
    assert "berisiko tinggi" in render_choices(raw, context).summary


@pytest.mark.parametrize("raw", [
    proposal(("provider_threat_match", ["EV-001"])),
    proposal(("provider_threat_match", ["EV-003"])),
    proposal(("provider_no_match", ["EV-004"])),
    proposal(("domain_reference_match", ["EV-005"])),
    proposal(("provider_disagreement", ["EV-001", "EV-002"])),
    proposal(("historical_report_context", ["EV-999"])),
    proposal(("url_structure_observation", ["EV-005", "EV-005"])),
    proposal(summary="Website ini aman."),
    proposal(risk_level="low"),
    '{"findings":[{"claim_type":"historical_report_context","evidence_ids":["EV-002"],"scope":"exact_url"}],"recommendations":["verify_official_source"]}',
    '{"findings":[],"recommendations":["run_a_tool"]}',
])
def test_rejects_unsupported_claims_and_model_generated_copy(raw):
    with pytest.raises((InvalidAnalystResponse, ValidationError)):
        render_choices(raw, assessment())


def test_disagreement_requires_same_url_and_positive_historical_record():
    context = assessment()
    context.evidence[1].scope = "exact_url"
    result = render_choices(proposal(("provider_disagreement", ["EV-001", "EV-002"])), context)
    assert result.findings[0].source == "Google Safe Browsing dan VirusTotal"
    assert "waktu dan cakupan" in result.findings[0].explanation


def test_ticket_expiration_and_admission_limit(monkeypatch):
    monkeypatch.setattr(ai_tickets, "monotonic", lambda: 0)
    tickets = ExplanationTickets()
    owner = Binding("user:one", "session-one")
    other = Binding("user:one", "session-two")
    first = tickets.issue(assessment(), owner)
    assert tickets.consume(first.ticket, other) is None
    assert tickets.consume(first.ticket, owner) is not None
    assert tickets.consume(first.ticket, owner) is None
    for _ in range(3):
        last = tickets.issue(assessment(), owner)
        assert last.status == "pending"
    assert tickets.issue(assessment(), owner).status == "rate_limited"
    monkeypatch.setattr(ai_tickets, "monotonic", lambda: 61)
    assert tickets.consume(last.ticket, owner) is None
    assert tickets.issue(assessment(), owner).status == "pending"


class Fake:
    def __init__(self, raw=None):
        self.raw = raw if raw is not None else proposal(("provider_not_requested", ["EV-001"]))
        self.calls = []

    async def generate(self, **args):
        self.calls.append(args)
        if isinstance(self.raw, Exception):
            raise self.raw
        return self.raw


def client_for(fake, enabled=True, key="backend-fixture-key", model="ministral-8b-latest"):
    app = create_app(Settings(_env_file=None, supabase_url=None, supabase_publishable_key=None,
                              awasin_ai_enabled=enabled, mistral_api_key=key, mistral_model=model))
    return TestClient(app)


def wire(client, fake):
    state = client.app.app.state
    state.analysis.adapters["link"] = UrlInspector()
    state.security_analyst.generator = fake


@pytest.mark.parametrize(('signed_in', 'retention', 'ai_result', 'write_status', 'expected'), [
    (False, 'manual', None, 201, None),
    (True, 'manual', None, 201, 'saved'),
    (True, 'manual', 'low', 201, 'saved'),
    (True, 'manual', 'timeout', 201, 'saved'),
    (True, 'disabled', None, 201, 'disabled'),
    (True, 'manual', None, None, 'unconfigured'),
    (True, 'manual', None, 403, 'unavailable'),
])
def test_url_history_uses_authenticated_owner_and_final_risk(signed_in, retention, ai_result, write_status, expected):
    fake = Fake(TimeoutError() if ai_result == 'timeout' else url_proposal('low'))
    owner = UUID('5a4b677f-9860-4ef1-8301-b44eb823fc52')
    writes = []

    def respond(request):
        if request.method == 'GET':
            assert request.url.path == '/rest/v1/profiles'
            assert request.headers['authorization'] == 'Bearer test-session'
            return httpx.Response(200, json=[{'id': str(owner), 'history_retention': retention, 'animation': 'system'}])
        assert request.url.path == '/rest/v1/scan_reports'
        assert 'authorization' not in request.headers and request.headers['apikey'] == 'sb_secret_fixture'
        writes.append(json.loads(request.content))
        return httpx.Response(write_status)

    with client_for(fake) as client:
        wire(client, fake)
        state = client.app.app.state
        identity = Identity(id=owner, email='fixture@example.org', role='user', aal='aal1', profile={'id': owner, 'display_name': 'Fixture'})
        state.identity = IdentityService(state.settings.model_copy(update={
            'supabase_url': 'https://fixture.supabase.co', 'supabase_publishable_key': SecretStr('sb_publishable_fixture'),
            'supabase_history_secret_key': SecretStr('sb_secret_fixture') if write_status is not None else None,
        }), httpx.AsyncClient(transport=httpx.MockTransport(respond)))
        client.app.app.dependency_overrides[optional_identity] = lambda: identity if signed_in else None
        headers = {'Authorization': 'Bearer test-session'} if signed_in else {}
        scan = client.post(API, headers=headers, json={
            'mode': 'link', 'url': 'https://example.org/reset-password/private-path?secret=private-query',
            'history_consent': True, 'url_ai_consent': ai_result is not None,
        }).json()
        result = scan
        if ai_result:
            assert not writes
            result = client.post(f'{API}/explanation', headers=headers, json={'ticket': scan['ai']['ticket'], 'consent': True}).json()
            assert 'history_report' not in fake.calls[0]['payload']
        assert result['history_status'] == expected
        if signed_in and retention == 'manual' and write_status is not None:
            row, = writes
            assert row['owner_id'] == str(owner) and row['id'] == scan['analysis_id'] and row['saved_at']
            assert row['safe_label'] == 'example.org' and row['result']['risk'] == ('low' if ai_result == 'low' else 'inconclusive')
            assert all(secret not in json.dumps(row) for secret in ('private-path', 'private-query', 'test-session', 'sb_secret_fixture'))
        else:
            assert not writes
        asyncio.run(state.identity.client.aclose())


@pytest.mark.parametrize("mode", ["link", "website"])
def test_scan_finishes_before_ai_and_explicit_consent_cannot_be_replayed(mode):
    fake = Fake()
    with client_for(fake) as client:
        wire(client, fake)
        data = {"mode": mode, "url": "https://example.org/private?token=private-fixture"}
        assert client.post(API, json=data).json()["ai"] is None
        assert client.post(API, json={**data, "ai_consent": False}).json()["ai"] is None
        assert client.post(API, json={**data, "ai_consent": "true"}).status_code == 422
        scan = client.post(API, json={**data, "ai_consent": True})
        assert scan.status_code == 200 and scan.json()["risk"] == "unknown" and not fake.calls
        ticket = scan.json()["ai"]["ticket"]
        request = {"ticket": ticket}
        for consent in ({}, {"consent": False}):
            assert client.post(f"{API}/explanation", json=request | consent).json()["status"] == "not_requested"
        assert client.post(f"{API}/explanation", json={**request, "consent": True, "risk": "low"}).status_code == 422
        assert not fake.calls
        response = client.post(f"{API}/explanation", json={**request, "consent": True})
        assert response.headers["cache-control"] == "no-store"
        assert response.json()["status"] == "completed" and "risk" not in response.json()
        assert client.post(f"{API}/explanation", json={**request, "consent": True}).json()["status"] == "unavailable"
        assert len(fake.calls) == 1
        assert all(value not in fake.calls[0]["payload"] for value in ("example.org", "/private", "private-fixture", "backend-fixture-key"))
        assert "backend-fixture-key" not in scan.text + response.text


def test_signed_in_ticket_is_bound_to_identity_and_original_bearer_session():
    fake = Fake()
    with client_for(fake) as client:
        wire(client, fake)

        def identity(request: Request):
            token = request.headers.get("authorization")
            if not token:
                return None
            id = UUID(int=2 if token.endswith("other-user") else 1)
            return Identity.model_construct(id=id)

        client.app.app.dependency_overrides[optional_identity] = identity
        origin = {"Authorization": "Bearer session-one"}
        scan = client.post(API, json={"mode": "link", "url": "https://example.org", "ai_consent": True}, headers=origin)
        request = {"ticket": scan.json()["ai"]["ticket"], "consent": True}
        for headers in ({}, {"Authorization": "Bearer session-two"}, {"Authorization": "Bearer other-user"}):
            assert client.post(f"{API}/explanation", json=request, headers=headers).json()["status"] == "unavailable"
        assert not fake.calls
        assert client.post(f"{API}/explanation", json=request, headers=origin).json()["status"] == "completed"


@pytest.mark.parametrize(("enabled", "key", "model", "status"), [
    (False, "fixture", "mistral-test", "disabled"),
    (True, None, "mistral-test", "unavailable"),
    (True, "fixture", "models/invalid", "unavailable"),
])
def test_unavailable_settings_skip_ticket(enabled, key, model, status):
    fake = Fake()
    with client_for(fake, enabled, key, model) as client:
        wire(client, fake)
        response = client.post(API, json={"mode": "link", "url": "https://example.org/", "ai_consent": True})
        assert response.json()["ai"] == {"status": status, "ticket": None}
        assert not fake.calls


@pytest.mark.parametrize(("raw", "status"), [
    (proposal(risk="low"), "validation_failed"), (TimeoutError(), "timeout"),
])
def test_ai_failure_preserves_deterministic_result(raw, status):
    fake = Fake(raw)
    with client_for(fake) as client:
        wire(client, fake)
        scan = client.post(API, json={"mode": "link", "url": "https://bса.org/", "ai_consent": True}).json()
        assert scan["risk"] == "medium"
        response = client.post(f"{API}/explanation", json={"ticket": scan["ai"]["ticket"], "consent": True}).json()
        assert response["status"] == status and response["summary"] is None
        assert "risk" not in response
