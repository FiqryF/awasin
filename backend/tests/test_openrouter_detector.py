import asyncio
import json

import httpx
import pytest

from app.modules.analysis.ai_analyst import AnalystEvidence, AnalystInput
from app.modules.analysis.openrouter_detector import ENDPOINT, OpenRouterDetector
from app.modules.analysis.threat_detector import ThreatDetector, build_input
from app.modules.analysis.url import parse_url

MODEL = "nvidia/nemotron-3.5-super-vl:free"
INPUT = build_input(parse_url("https://login-bca.example.com/verify-account?session=fixture-private"),
                    AnalystInput(risk="medium", status="completed", evidence=[
                        AnalystEvidence(id="EV-001", source="url_structure", code="account_path",
                                        status="observed", severity="medium"),
                    ]))


def run(handler):
    detector = ThreatDetector(True, OpenRouterDetector("fixture-secret", MODEL, httpx.MockTransport(handler)))
    return asyncio.run(detector.detect(INPUT, "fixture", consent=True))


def test_openrouter_wire_uses_one_free_model_and_sanitized_schema():
    calls = []

    def reply(request):
        calls.append(request)
        assert request.method == "POST" and str(request.url) == ENDPOINT
        assert request.headers["authorization"] == "Bearer fixture-secret"
        assert b"login-bca.example.com" in request.content
        assert all(value not in request.content for value in (b"verify-account", b"fixture-private", b"fixture-secret"))
        body = json.loads(request.content)
        assert body["model"] == MODEL and "models" not in body and "tools" not in body
        assert body["provider"] == {"require_parameters": True, "allow_fallbacks": False,
                                    "max_price": {"prompt": 0, "completion": 0, "request": 0}}
        schema = body["response_format"]["json_schema"]
        assert schema["strict"] is True and "$defs" not in schema["schema"]
        assert set(schema["schema"]["properties"]) == {"verdict", "evidence_ids", "findings"}
        assert schema["schema"]["properties"]["findings"]["items"]["additionalProperties"] is False
        assert body["reasoning"] == {"enabled": False, "exclude": True}
        features = json.loads(body["messages"][-1]["content"])["features"]
        ref = next(item["id"] for item in features if item["code"] == "brand_outside_reference")
        assert schema["schema"]["properties"]["verdict"]["enum"] == ["suspicious"]
        assert schema["schema"]["properties"]["evidence_ids"]["items"]["enum"] == [
            *(item["id"] for item in features), "EV-001",
        ]
        guidance = json.loads(body["messages"][1]["content"].split("\n", 1)[1])
        assert guidance["preferred_verdict_evidence_ids"] == ["EV-001"]
        raw = json.dumps({"verdict": "suspicious", "evidence_ids": [ref],
                          "findings": [{"category": "brand_mismatch", "feature_ids": [ref]}]})
        return httpx.Response(200, json={"model": MODEL, "usage": {"cost": 0},
                                       "choices": [{"finish_reason": "stop", "message": {"content": raw}}]})

    result = run(reply)
    assert result.status == "completed" and result.findings[0].assessment == "observed"
    assert len(calls) == 1


@pytest.mark.parametrize("model", ["openrouter/free", "openrouter/auto", "vendor/paid", "vendor/model:free?bad"])
def test_rejects_non_explicit_free_model(model):
    with pytest.raises(ValueError):
        OpenRouterDetector("fixture", model)


@pytest.mark.parametrize(("status", "expected"), [(401, "unavailable"), (403, "unavailable"), (404, "unavailable"),
                                                   (429, "rate_limited"), (503, "unavailable"), (307, "unavailable")])
def test_provider_failure_does_not_redirect_or_retry(status, expected):
    calls = []

    def reply(request):
        calls.append(request)
        return httpx.Response(status, headers={"location": "https://example.invalid/"})

    assert run(reply).status == expected
    assert len(calls) == 1


@pytest.mark.parametrize(("model", "cost"), [("other/model:free", 0), (MODEL, 1), (MODEL.removesuffix(":free"), None)])
def test_unexpected_model_or_cost_is_rejected(model, cost):
    result = run(lambda _: httpx.Response(200, json={
        "model": model, "usage": {"cost": cost}, "choices": [{"finish_reason": "stop", "message": {"content": '{"findings":[]}'}}],
    }))
    assert result.status == "validation_failed"


def test_truncated_provider_output_is_rejected_even_when_json_is_complete():
    result = run(lambda _: httpx.Response(200, json={
        "model": MODEL, "usage": {"cost": 0}, "choices": [{"finish_reason": "length", "message": {"content": '{"findings":[]}'}}],
    }))
    assert result.status == "validation_failed"


def test_catalog_canonical_model_is_accepted_only_at_explicit_zero_cost():
    adapter = OpenRouterDetector("fixture", "nvidia/nemotron-3.5-super-vl:free")
    data = {
        "model": "nvidia/nemotron-3.5-super-vl-20261015",
        "usage": {"cost": 0},
        "choices": [{"finish_reason": "stop", "message": {"content": '{"findings":[]}'}}],
    }
    assert adapter.read_content(data) == '{"findings":[]}'
    with pytest.raises(ValueError):
        adapter.read_content({**data, "usage": {}})
