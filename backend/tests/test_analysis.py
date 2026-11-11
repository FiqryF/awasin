import asyncio
import json
from datetime import UTC, datetime
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from app.main import create_app
from app.modules.analysis import router
from app.modules.analysis.orchestrator import AnalysisInput, AnalysisOrchestrator
from app.modules.analysis.schemas import EngineResult, Evidence, Provenance
from app.modules.analysis.validation import public_url
from app.modules.identity.router import service
from app.modules.identity.service import unauthorized

API = "/api/v1/analysis"


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


def image_bytes(fmt="PNG", size=(10, 10)):
    stream = BytesIO()
    with Image.new("RGB", size) as image:
        image.save(stream, format=fmt)
    return stream.getvalue()


def box(kind, data):
    return (8 + len(data)).to_bytes(4, "big") + kind + data


@pytest.mark.parametrize("payload", [
    {"mode": "link", "url": "https://example.com/?marker=private"},
    {"mode": "website", "url": "bücher.example"},
    {"mode": "message", "text": "Pesan sintetis untuk tes"},
    {"mode": "qr", "payload": "WIFI:T:WPA;S:example;P:private;;"},
    {"mode": "qr", "payload": "https://example.com"},
])
def test_unavailable_is_not_a_report(client, payload):
    request_id = str(uuid4())
    response = client.post(API, json={**payload, "request_id": request_id, "history_consent": True})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["mode"] == payload["mode"] and data["request_id"] == request_id
    assert data["status"] == data["processing"] == "unavailable"
    assert data["risk"] == "unknown" and data["history_eligible"] is False
    assert data["provenance"] is None and data["evidence"] == []
    assert data["error_code"] == "engine_unavailable"
    assert "private" not in response.text


@pytest.mark.parametrize("mode, content_type, content, metadata", [
    ("message", "image/png", image_bytes(), {"mode": "message", "text": "Private fixture text"}),
    ("qr", "image/jpeg", image_bytes("JPEG"), {}),
    ("image", "image/webp", image_bytes("WEBP"), {}),
    # Container envelopes only. No samples are decoded or treated as real detections.
    ("video", "video/mp4", box(b"ftyp", b"isom\0\0\0\0") + box(b"moov", box(b"mvhd", b"test") + box(b"trak", b"test")) + box(b"mdat", b"test"), {}),
    ("video", "video/webm", bytes.fromhex("1a45dfa3874282847765626d185380678c1654ae6b81ff1f43b67581ff"), {}),
])
def test_media_modes(client, mode, content_type, content, metadata):
    form = {"metadata": json.dumps(metadata)} if metadata else None
    result = client.post(f"{API}/media/{mode}", data=form, files={"file": ("private-name", content, content_type)})
    assert result.status_code == 200
    assert result.json()["status"] == "unavailable"
    assert result.json()["media"]["content_type"] == content_type
    assert result.json()["media"]["size_bytes"] == len(content)
    assert "private-name" not in result.text and "Private fixture" not in result.text


@pytest.mark.parametrize("url", [
    "file:///example", "https://user:secret@example.com", "https://localhost",
    "https://127.0.0.1", "https://192.168.1.1", "https://169.254.169.254",
    "https://[::1]", "https://[fc00::1]", "https://[::ffff:127.0.0.1]",
    "https://2130706433", "https://0177.0.0.1", "https://127.1",
    "https://example.com\\private", "https://example.com\n", "https://example.com:0",
])
def test_unsafe_urls_are_rejected(client, url):
    response = client.post(API, json={"mode": "link", "url": url})
    assert response.status_code == 422
    assert "secret" not in response.text


def test_normalization_keeps_encoded_query_and_removes_fragment():
    assert public_url("HTTPS://BÜCHER.example/p?a=%2F#private") == "https://xn--bcher-kva.example/p?a=%2F"
    assert public_url("example.com/path", allow_domain=True) == "https://example.com/path"


@pytest.mark.parametrize("payload", [
    {"mode": "bogus"}, {"mode": "image"}, {"mode": "link"},
    {"mode": "message", "text": " "}, {"mode": "message", "text": "Text with a null\0byte"},
    {"mode": "qr", "payload": "http://localhost/a"},
    {"mode": "qr", "payload": "x" * 4097}, {"mode": "website", "url": "example.com", "risk": "low"},
])
def test_invalid_requests(client, payload):
    assert client.post(API, json=payload).status_code == 422


@pytest.mark.parametrize("mode, content_type, content", [
    ("image", "image/png", b"not an image"),
    ("image", "image/webp", image_bytes()),
    ("image", "image/png", image_bytes()[:-10]),
    ("image", "image/png", image_bytes(size=(8193, 1))),
    ("image", "image/gif", b"GIF89a" * 10),
    ("video", "video/mp4", box(b"ftyp", b"isom\0\0\0\0") + box(b"mdat", b"test")),
    ("video", "video/webm", bytes.fromhex("1a45dfa3874282847765626d1853806784ff")),
])
def test_malformed_or_unsupported_media(client, mode, content_type, content):
    assert client.post(f"{API}/media/{mode}", files={"file": ("sample", content, content_type)}).status_code == 422


def test_chunked_and_declared_limits_and_multipart_shape(client, monkeypatch):
    monkeypatch.setattr(router, "IMAGE_LIMIT", 16)
    monkeypatch.setattr(router, "FORM_OVERHEAD", 128)
    headers = {"Content-Type": "multipart/form-data; boundary=test"}
    prefix = b"--test\r\nContent-Disposition: form-data; name=\"file\"; filename=\"fixture\"\r\n\r\n"
    assert client.post(API, content=b"x" * 262145).status_code == 413
    assert client.post(f"{API}/media/image", headers=headers, content=b"x" * 145).status_code == 413
    assert client.post(f"{API}/media/image", headers=headers, content=iter([prefix, b"x" * 100])).status_code == 413
    assert client.post(f"{API}/media/image", headers=headers, content=prefix + b"truncated").status_code == 422
    assert client.post(f"{API}/media/image", json={}).status_code == 415


def test_optional_auth_and_consent(client, app):
    owner = uuid4()
    captured = []

    class Provider:
        async def resolve(self, token):
            if token != "fixture-valid":
                raise unauthorized()
            return SimpleNamespace(id=owner)

    class RecordingEngine(AnalysisOrchestrator):
        async def run(self, request):
            captured.append(request)
            return await super().run(request)

    app.app.dependency_overrides[service] = Provider
    app.app.state.analysis = RecordingEngine()
    payload = {"mode": "link", "url": "https://example.com", "history_consent": True}
    assert client.post(API, json=payload).status_code == 200
    for token in ("Basic fixture", "Bearer wrong", "Bearer token extra"):
        assert client.post(API, json=payload, headers={"Authorization": token}).status_code == 401
    result = client.post(API, json=payload, headers={"Authorization": "Bearer fixture-valid"})
    assert result.status_code == 200 and result.json()["history_eligible"] is False
    guest, signed_in = captured
    assert guest.owner_id is None and guest.history_consent is False
    assert signed_in.owner_id == str(owner) and signed_in.history_consent is True


def test_openapi_describes_optional_auth_and_media(client):
    paths = client.get("/openapi.json").json()["paths"]
    for path in (API, f"{API}/media/{{mode}}"):
        assert {} in paths[path]["post"]["security"]
        assert {"HTTPBearer": []} in paths[path]["post"]["security"]
    body = paths[f"{API}/media/{{mode}}"]["post"]["requestBody"]
    assert body["content"]["multipart/form-data"]["schema"]["properties"]["file"]["format"] == "binary"


def test_adapter_results_timeout_errors_and_cancellation():
    now = datetime.now(UTC)
    provenance = Provenance(engine="fixture", version="1", source_type="test", checked_at=now)
    evidence = Evidence(code="fixture", kind="test", explanation="Fixture", source="Test", observed_at=now, validation="verified")

    class Adapter:
        async def analyze(self, request):
            if request.text == "timeout":
                await asyncio.sleep(10)
            if request.text == "failed":
                raise RuntimeError("private-provider-message")
            return EngineResult(status=request.text, explanation="Fixture", evidence=[evidence], provenance=provenance)

    async def run():
        engine = AnalysisOrchestrator({"message": Adapter()}, timeout=0.02)
        for status in ("completed", "partial", "inconclusive", "failed", "timeout"):
            result = await engine.run(AnalysisInput("message", uuid4(), None, False, text=status))
            assert result.status == ("failed" if status == "timeout" else status)
            assert result.risk == "unknown" and result.history_eligible is False
            if status in {"failed", "timeout"}:
                assert result.error_code == f"engine_{status}" and result.provenance is None
                assert "private-provider-message" not in result.model_dump_json()
            else:
                assert result.evidence == [evidence] and result.provenance == provenance
        task = asyncio.create_task(engine.run(AnalysisInput("message", uuid4(), None, False, text="timeout")))
        await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    with pytest.raises(ValidationError):
        EngineResult(status="completed", risk="low", explanation="No evidence", provenance=provenance)


def test_capacity_rejects_concurrent_work_and_releases_slot():
    async def run():
        engine = AnalysisOrchestrator(max_concurrent=1)
        async with router.analysis_slot(engine):
            async def another_request():
                with pytest.raises(router.HTTPException) as error:
                    async with router.analysis_slot(engine):
                        pytest.fail("second request acquired the only slot")
                assert error.value.status_code == 429

            await asyncio.create_task(another_request())
        async with router.analysis_slot(engine):
            assert engine.capacity.borrowed_tokens == 1

    asyncio.run(run())
