import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.analysis.ai_analyst import AnalystInput
from app.modules.analysis.threat_detector import DetectorProviderError, ThreatDetector, build_input
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
        return json.dumps({"findings": findings})


@pytest.mark.parametrize(("url", "expected"), [
    (URL, {"brand_outside_reference", "credential_path", "credential_parameter"}),
    ("https://www.bca.co.id/id/individu", {"official_domain", "has_subdomain"}),
    ("https://bca.co.id.example.com/", {"official_name_in_subdomain", "deep_subdomain"}),
    ("https://bса.com/", {"idn", "similar_domain"}),
    ("https://bankindonesi.com/", {"similar_domain"}),
    ("https://example.com/" + "a" * 130 + "%2F", {"long_path", "encoded_path"}),
    ("https://example.com/?next=fixture&unrecognized-private-name=hidden", {"redirect_parameter", "other_parameter"}),
])
def test_url_characteristics_are_extracted_without_raw_url(url, expected):
    payload = build_input(parse_url(url), ASSESSMENT)
    assert expected <= {item.code for item in payload.features}
    serialized = payload.model_dump_json()
    for private in (url, "example.com", "private-fixture", "unrecognized-private-name", "hidden"):
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
        assert client.post("/api/v1/analysis/explanation", json=request).json()["status"] == "unavailable"
        assert len(provider.calls) == len(explainer.calls) == 1
