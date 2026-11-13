import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.analysis.ai_analyst import AnalystInput, AnalystEvidence
from app.modules.analysis.threat_detector import DetectorProviderError, ThreatDetector, build_input, validate_detector
from app.modules.analysis.url import parse_url

URL = "https://login-bca.example.com/verify-account?session=private-fixture"
ASSESSMENT = AnalystInput(risk="unknown", status="inconclusive", evidence=[])


class FixtureDetector:
    def __init__(self, failure=None):
        self.failure = failure
        self.calls = []

    async def inspect(self, *, payload, schema):
        self.calls.append(payload)
        assert schema["additionalProperties"] is False
        if isinstance(self.failure, Exception):
            raise self.failure
        if self.failure is not None:
            return self.failure
        features = {item["code"]: item["id"] for item in json.loads(payload)["features"]}
        findings = []
        if "brand_outside_reference" in features:
            findings.append({"category": "brand_mismatch", "feature_ids": [features["brand_outside_reference"]]})
            if "credential_path" in features:
                findings.append({"category": "credential_lure",
                                 "feature_ids": [features["brand_outside_reference"], features["credential_path"]]})
        return json.dumps({"findings": findings, "verdict": "suspicious" if findings else "unknown",
                           "evidence_ids": [features["brand_outside_reference"]] if findings else []})


@pytest.mark.parametrize(("url", "expected"), [
    (URL, {"brand_outside_reference", "credential_path", "credential_parameter"}),
    ("https://www.bca.co.id/id/individu", {"official_domain", "has_subdomain"}),
    ("https://bca.co.id.example.com/", {"official_name_in_subdomain", "deep_subdomain"}),
    ("https://bса.com/", {"idn", "similar_domain"}),
    ("https://bankindonesi.com/", {"similar_domain"}),
    ("https://example.com/" + "a" * 130 + "%2F", {"long_path", "encoded_path"}),
    ("https://example.com/?next=fixture&unrecognized-private-name=hidden", {"redirect_parameter", "other_parameter"}),
])
def test_hostname_is_shared_but_path_and_query_remain_private(url, expected):
    payload = build_input(parse_url(url), ASSESSMENT)
    assert expected <= {item.code for item in payload.features}
    serialized = payload.model_dump_json()
    assert payload.hostname == parse_url(url).hostname
    for private in (url, "private-fixture", "unrecognized-private-name", "hidden", "verify-account"):
        assert private not in serialized


@pytest.mark.parametrize(("failure", "status"), [
    (httpx.ReadTimeout("fixture"), "timeout"),
    *[(DetectorProviderError(code), "unavailable") for code in (400, 401, 403, 500)],
    (DetectorProviderError(429), "rate_limited"),
    ("broken-json", "validation_failed"),
    ('{"findings":[{"category":"brand_mismatch","feature_ids":["UF-99"]}]}', "validation_failed"),
    ('{"findings":[{"category":"brand_mismatch","feature_ids":["UF-01"]}]}', "validation_failed"),
    ('{"findings":[],"verdict":"high"}', "validation_failed"),
])
def test_detector_fails_closed(failure, status):
    async def run():
        provider = FixtureDetector(failure)
        detector = ThreatDetector(True, provider)
        result = await detector.detect(build_input(parse_url(URL), ASSESSMENT), "test", consent=True)
        assert result.status == status and not result.findings
        assert len(provider.calls) == 1
    asyncio.run(run())


def test_detector_consent_and_quota_are_separate_per_subject():
    async def run():
        provider = FixtureDetector()
        payload = build_input(parse_url(URL), ASSESSMENT)
        assert await ThreatDetector(True, provider).detect(payload, "one") is None
        assert (await ThreatDetector(False, provider).detect(payload, "one", consent=True)).status == "disabled"
        assert (await ThreatDetector(True).detect(payload, "one", consent=True)).status == "unavailable"
        assert not provider.calls
        detector = ThreatDetector(True, provider)
        for _ in range(4):
            assert (await detector.detect(payload, "one", consent=True)).status == "completed"
        assert (await detector.detect(payload, "one", consent=True)).status == "rate_limited"
        assert (await detector.detect(payload, "two", consent=True)).status == "completed"
        assert len(provider.calls) == 5
    asyncio.run(run())


def test_detector_cancellation_releases_capacity():
    async def run():
        started = asyncio.Event()
        cancelled = asyncio.Event()

        class WaitingDetector:
            async def inspect(self, **_):
                started.set()
                try:
                    await asyncio.Future()
                finally:
                    cancelled.set()

        detector = ThreatDetector(True, WaitingDetector())
        payload = build_input(parse_url(URL), ASSESSMENT)
        operation = asyncio.create_task(detector.detect(payload, "one", consent=True))
        await asyncio.wait_for(started.wait(), timeout=1)
        operation.cancel()
        with pytest.raises(asyncio.CancelledError):
            await operation
        assert cancelled.is_set()
        detector.provider = FixtureDetector()
        assert (await detector.detect(payload, "one", consent=True)).status == "completed"

    asyncio.run(run())


def test_detector_is_separate_and_only_validated_observations_reach_mistral():
    provider = FixtureDetector()
    app = create_app(Settings(_env_file=None, ai_threat_detector_enabled=True,
                              awasin_ai_enabled=True, mistral_api_key="fixture"))
    class Explainer:
        calls = []

        async def generate(self, **kwargs):
            self.calls.append(json.loads(kwargs["payload"]))
            return '{"findings":[],"recommendations":["verify_official_source"]}'

    explainer = Explainer()
    with TestClient(app) as client:
        app.app.state.threat_detector.provider = provider
        app.app.state.security_analyst.generator = explainer
        data = {"mode": "link", "url": URL}
        baseline = client.post("/api/v1/analysis", json=data).json()
        assert baseline["detector"] is None and not provider.calls
        for bad in ("file:///tmp/example", "https://127.0.0.1/"):
            assert client.post("/api/v1/analysis", json={**data, "url": bad, "detector_consent": True}).status_code == 422
        assert client.post("/api/v1/analysis", json={**data, "detector_consent": "true"}).status_code == 422
        assert not provider.calls
        result = client.post("/api/v1/analysis", json={**data, "detector_consent": True, "ai_consent": True}).json()
        assert result["risk"] == baseline["risk"]
        assert result["detector"]["status"] == "completed"
        assert [item["assessment"] for item in result["detector"]["findings"]] == ["observed", "suspected"]
        assert len(provider.calls) == 1 and "private-fixture" not in provider.calls[0]
        request = {"ticket": result["ai"]["ticket"], "consent": True}
        assert client.post("/api/v1/analysis/explanation", json=request).json()["status"] == "completed"
        assert explainer.calls[0]["detector_observations"] == ["brand_mismatch"]
        assert "detector_verdict" not in explainer.calls[0]
        assert "example.com" not in json.dumps(explainer.calls)
        assert client.post("/api/v1/analysis/explanation", json=request).json()["status"] == "unavailable"
        assert len(provider.calls) == len(explainer.calls) == 1


def test_deferred_detector_does_not_delay_scan_and_ticket_cannot_be_replayed(settings):
    provider = FixtureDetector()
    with TestClient(create_app(settings)) as client:
        detector = client.app.app.state.threat_detector
        detector.enabled = True
        detector.provider = provider
        data = {"mode": "link", "url": URL, "defer_detector": True}
        assert client.post("/api/v1/analysis", json=data).json()["detector_offer"] is None
        response = client.post("/api/v1/analysis", json={**data, "detector_consent": True})
        result = response.json()
        assert result["risk"] == "medium"
        assert result["detector"] is None and not provider.calls
        request = {"ticket": result["detector_offer"]["ticket"], "consent": True}
        path = "/api/v1/analysis/detector"
        assert client.post(path, json={**request, "consent": False}).json()["status"] == "unavailable"
        assert not provider.calls
        assert client.post(path, json=request).json()["status"] == "completed"
        assert client.post(path, json=request).json()["status"] == "unavailable"
        assert len(provider.calls) == 1


def test_legitimacy_needs_domain_reference_and_no_match_and_cannot_override_threats():
    assessment = AnalystInput(risk="unknown", status="partial", evidence=[
        AnalystEvidence(id="EV-001", source="google_safe_browsing", code="threat_lookup", status="no_match"),
    ])
    payload = build_input(parse_url("https://www.bca.co.id/id/individu?token=secret"), assessment)
    official = next(item.id for item in payload.features if item.code == "official_domain")
    raw = json.dumps({"verdict": "likely_legitimate", "evidence_ids": [official, "EV-001"], "findings": []})
    assert validate_detector(raw, payload).verdict == "likely_legitimate"
    for mutation in ("missing_reference", "threat_match", "risk_high", "archive_alert"):
        candidate = payload.model_copy(deep=True)
        if mutation == "missing_reference":
            candidate.features = [item for item in candidate.features if item.id != official]
        elif mutation == "threat_match":
            candidate.assessment.evidence[0].status = "match"
        elif mutation == "risk_high":
            candidate.assessment.risk = "high"
        else:
            candidate.assessment.evidence.append(AnalystEvidence(id="EV-002", source="virustotal", code="supplementary_lookup",
                status="found", scope="exact_url", historical_verdict="malicious"))
        with pytest.raises(ValueError):
            validate_detector(raw, candidate)


def test_https_alone_cannot_support_safe_or_malicious_verdicts():
    payload = build_input(parse_url("https://example.com/"), ASSESSMENT)
    for verdict in ("likely_legitimate", "malicious", "suspicious"):
        raw = json.dumps({"verdict": verdict, "evidence_ids": [payload.features[0].id], "findings": []})
        with pytest.raises(ValueError):
            validate_detector(raw, payload)
    raw = json.dumps({"verdict": "unknown", "evidence_ids": [], "findings": []})
    assert validate_detector(raw, payload).verdict == "unknown"


def test_required_features_allow_extra_valid_references_but_only_report_supporting_ids():
    payload = build_input(parse_url(URL), ASSESSMENT)
    refs = {item.code: item.id for item in payload.features}
    cited = [refs[code] for code in ("credential_path", "credential_parameter", "brand_outside_reference")]
    raw = json.dumps({"verdict": "suspicious", "evidence_ids": cited,
        "findings": [{"category": "credential_lure", "feature_ids": cited}]})
    result = validate_detector(raw, payload)
    assert result.verdict == "suspicious"
    assert set(result.findings[0].feature_ids) == {refs['credential_path'], refs['brand_outside_reference']}
