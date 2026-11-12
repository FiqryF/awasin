import asyncio
import json

import httpx
import pytest

from app.core.config import Settings
from app.modules.analysis.ai_analyst import AnalystEvidence, AnalystInput, SecurityAnalyst
from app.modules.analysis.ai_validator import SCHEMA, SYSTEM, explain
from app.modules.analysis.mistral import ENDPOINT, MAX_RESPONSE_BYTES, MistralGenerator

KEY = "fixture-mistral-key"
MODEL = "ministral-8b-latest"
ASSESSMENT = AnalystInput(risk="unknown", status="partial", evidence=[
    AnalystEvidence(id="EV-001", source="url_structure", code="redirect_parameter", status="observed"),
])
PROPOSAL = {
    "findings": [{"claim_type": "cross_domain_redirect_indicator", "evidence_ids": ["EV-001"]}],
    "recommendations": ["verify_official_source"],
}


def completion(content, finish="stop"):
    return httpx.Response(200, json={"choices": [{"finish_reason": finish, "message": {"content": content}}]})


def analyst_for(handler, **settings):
    config = Settings(_env_file=None, awasin_ai_enabled=True, mistral_api_key=KEY, **settings)
    return SecurityAnalyst(config, MistralGenerator(httpx.MockTransport(handler)))


@pytest.mark.parametrize("override", [{}, {"mistral_model": "ministral-8b-2512"}])
def test_mistral_wire_and_validated_explanation(override):
    before = ASSESSMENT.model_dump()
    calls = []

    def handle(request):
        calls.append(request.method)
        assert str(request.url) == ENDPOINT
        assert request.headers["authorization"] == f"Bearer {KEY}"
        assert request.headers["accept-encoding"] == "identity"
        assert KEY.encode() not in request.content
        assert json.loads(request.content) == {
            "model": override.get("mistral_model", MODEL),
            "messages": [{"role": "system", "content": SYSTEM}, {
                "role": "user", "content": ASSESSMENT.model_dump_json(exclude_none=True),
            }],
            "max_tokens": 700,
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "awasin_evidence", "schema": SCHEMA, "strict": True,
            }},
        }
        return completion(json.dumps(PROPOSAL))

    result = asyncio.run(explain(analyst_for(handle, **override), ASSESSMENT, consent=True))
    assert calls == ["POST"]
    assert result.status == "completed" and result.findings[0].evidence_ids == ["EV-001"]
    assert ASSESSMENT.model_dump() == before and "risk" not in result.model_dump()


@pytest.mark.parametrize(("status", "fallback"), [
    (307, "unavailable"), (400, "unavailable"), (401, "unavailable"), (403, "unavailable"),
    (429, "rate_limited"), (503, "unavailable"),
])
def test_provider_errors_do_not_retry_or_expose_details(status, fallback):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(status, text=KEY, headers={"location": "https://example.invalid/"})

    async def run():
        analyst = analyst_for(handle)
        result = await explain(analyst, ASSESSMENT, consent=True)
        assert result.status == fallback and KEY not in result.model_dump_json()
        if status == 429:
            assert (await explain(analyst, ASSESSMENT, consent=True)).status == "rate_limited"

    asyncio.run(run())
    assert len(calls) == 1


@pytest.mark.parametrize("reply", [
    completion('{"findings":[],"findings":[],"recommendations":["verify_official_source"]}'),
    completion(json.dumps(PROPOSAL), finish="length"),
    httpx.Response(200, json={"choices": []}),
    httpx.Response(200, content=b" " * (MAX_RESPONSE_BYTES + 1), headers={"content-type": "application/json"}),
])
def test_malformed_or_oversized_provider_output_uses_validation_fallback(reply):
    result = asyncio.run(explain(analyst_for(lambda _: reply), ASSESSMENT, consent=True))
    assert result.status == "validation_failed" and not result.findings


@pytest.mark.parametrize(("failure", "fallback"), [
    (httpx.ReadTimeout, "timeout"), (httpx.ConnectError, "unavailable"),
])
def test_network_error_uses_fallback(failure, fallback):
    def handle(_):
        raise failure(KEY)

    result = asyncio.run(explain(analyst_for(handle), ASSESSMENT, consent=True))
    assert result.status == fallback and KEY not in result.model_dump_json()


def test_concurrency_bound_holds_for_separate_tickets():
    async def run():
        all_started = asyncio.Event()
        release = asyncio.Event()
        calls = []

        async def handle(request):
            calls.append(request)
            if len(calls) == 2:
                all_started.set()
            await release.wait()
            return completion(json.dumps(PROPOSAL))

        analyst = analyst_for(handle)
        jobs = [asyncio.create_task(explain(analyst, ASSESSMENT, consent=True)) for _ in range(2)]
        try:
            await asyncio.wait_for(all_started.wait(), timeout=2)
            assert (await explain(analyst, ASSESSMENT, consent=True)).status == "rate_limited"
        finally:
            release.set()
            results = await asyncio.gather(*jobs)
        assert [result.status for result in results] == ["completed", "completed"]
        assert len(calls) == 2

    asyncio.run(run())
