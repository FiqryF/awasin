import json
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.analysis import ai_tickets
from app.modules.analysis.ai_tickets import Binding, ExplanationTickets
from app.modules.analysis.ai_validator import render_choices
from app.modules.analysis.ai_analyst import AnalystEvidence, AnalystInput
from app.modules.analysis.mistral import InvalidAnalystResponse
from app.modules.analysis.inspect_url import UrlInspector
from app.modules.analysis.router import optional_identity
from app.modules.identity.service import Identity
from pydantic import ValidationError
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
        self.raw = raw if raw is not None else proposal(("provider_unavailable", ["EV-001"]))
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
