import asyncio
from datetime import UTC, datetime
import json

import httpx
import pytest

from app.modules.analysis.inspect_url import UrlInspector
from app.modules.analysis.url import parse_url
from app.modules.analysis.vtai import ENDPOINT, VirusTotalAI
from test_ai_explanation import API, Fake, client_for, url_proposal, wire


def report(labels, stats=None, url="https://EXAMPLE.org"):
    return {"data": {
        "type": "url", "url": url, "detections": labels,
        "last_analysis_stats": stats or {},
        "coverage": {"engines": len(labels)},
        "analysis_date": datetime.now(UTC).isoformat(),
    }}


@pytest.mark.parametrize(("labels", "stats", "verdict"), [
    (["clean", "unrated"], {"harmless": 1, "undetected": 1}, "no_detection"),
    (["malicious"], {}, "malicious"),
    (["suspicious"], {}, "suspicious"),
    (["unrated"], {}, "unknown"),
    (["malicious"], {"harmless": 1}, "unknown"),
])
def test_normalizes_vtai_report(labels, stats, verdict):
    result = VirusTotalAI.parse(report(labels, stats), parse_url("https://example.org/"))
    assert result.verdict == verdict
    assert result.engine_count == len(labels)
    if labels == ["unrated"]:
        assert result.counts == {"undetected": 1}
    if stats == {"harmless": 1}:
        assert not result.counts and any("tidak konsisten" in note for note in result.limitations)


@pytest.mark.parametrize(("reply", "status"), [
    (401, "unauthorized"), (403, "unauthorized"), (404, "not_found"),
    (429, "rate_limited"), (503, "unavailable"), ("timeout", "timeout"),
    ("invalid", "error"), ("oversize", "error"), ("wrong_type", "error"),
    ("wrong_url", "error"),
])
def test_vtai_failures_preserve_link_inspection(reply, status):
    def respond(request):
        assert request.method == "POST" and str(request.url) == ENDPOINT
        if reply == "timeout":
            raise httpx.ReadTimeout("fixture", request=request)
        if reply == "invalid":
            return httpx.Response(200, content=b"{", headers={"Content-Type": "application/json"})
        if reply == "oversize":
            return httpx.Response(200, content=b" " * (256 * 1024 + 1), headers={"Content-Type": "application/json"})
        if reply == "wrong_type":
            return httpx.Response(200, content=b"{}", headers={"Content-Type": "text/html"})
        if reply == "wrong_url":
            return httpx.Response(200, json=report(["clean"], url="https://other.example.org/"))
        return httpx.Response(reply)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            engine = UrlInspector(vtai=VirusTotalAI(client, "fixture-token"))
            result = await engine.inspect(parse_url("https://example.org/"), enhanced_consent=True)
            assert result.risk == "unknown"
            assert result.url_report.supplementary_checks[-1].status == status

    asyncio.run(run())


@pytest.mark.parametrize(("risk", "label", "expected"), [
    ("low", "clean", "completed"), ("medium", "malicious", "completed"),
    ("unknown", "unrated", "completed"), ("high", "clean", "completed"),
    ("low", "malicious", "validation_failed"), ("high", "malicious", "validation_failed"),
])
def test_vtai_evidence_reaches_the_mistral_ticket(risk, label, expected):
    calls = []
    class Analyst(Fake):
        async def generate(self, **args):
            self.calls.append(args)
            items = json.loads(args["payload"])["evidence"]
            entry = next(item for item in items if item["source"] == "vtai")
            assert entry["engine_count"] == 2 and entry["analysis_date"]
            assert entry["counts"] == {{"clean": "harmless", "unrated": "undetected"}.get(label, label): 2}
            return url_proposal(risk, [entry["id"]] if risk != "high" or expected != "completed"
                                else [next(item["id"] for item in items if item["code"] == "confusable")])

    fake = Analyst()
    url = "https://www.bn1.co.id/" if risk == "high" and expected == "completed" else "https://example.org/"

    def respond(request):
        calls.append(request)
        assert request.headers["Authorization"] == "Bearer fixture-token"
        assert json.loads(request.content) == {"url": url}
        return httpx.Response(200, json=report([label, label], url=url))

    with client_for(fake) as client:
        wire(client, fake)
        http = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        client.app.app.state.analysis.adapters["link"] = UrlInspector(vtai=VirusTotalAI(http, "fixture-token"))
        data = {"mode": "link", "url": url}
        for url_variant, consent in ((url, False), (url + "?token=private", True), (url + "reset-password/secret", True)):
            result = client.post(API, json={**data, "url": url_variant, "enhanced_lookup_consent": consent}).json()
            assert result["url_report"]["supplementary_checks"][-1]["status"] == "skipped"
        assert not calls
        scan = client.post(API, json={**data, "enhanced_lookup_consent": True, "url_ai_consent": True}).json()
        assert scan["url_report"]["supplementary_checks"][-1]["provider"] == "VirusTotal AI"
        response = client.post(f"{API}/explanation", json={"ticket": scan["ai"]["ticket"], "consent": True})
        assert response.json()["status"] == expected
        if expected == "completed":
            assert response.json()["risk"] == risk
        assert "fixture-token" not in json.dumps(scan) + response.text + fake.calls[0]["payload"]
        assert len(calls) == 1
        asyncio.run(http.aclose())
