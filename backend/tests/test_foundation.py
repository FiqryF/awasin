from importlib.metadata import version
import logging
import os
import sys

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError
import pytest

from app.core.config import Settings
from app.core.logging import SafeFormatter
from app.main import create_app
from app.modules.health.schemas import HealthResponse


def test_health_and_documentation(settings):
    app = create_app(settings)
    with TestClient(app) as client:
        expected = {"status": "ok", "service": "awasin-backend", "version": version("awasin-backend")}
        for path in ["/health", "/api/v1/health"]:
            response = client.get(path)
            assert response.status_code == 200
            assert response.json() == expected
            assert HealthResponse.model_validate(response.json()).status == "ok"
        for path in ["/docs", "/redoc", "/openapi.json"]:
            assert client.get(path).status_code == 200
        schema = client.get("/openapi.json").json()
        assert schema["info"]["version"] == expected["version"]
        assert set(schema["paths"]) == {"/health", "/api/v1/health", "/api/v1/auth/me", "/api/v1/profiles/me", "/api/v1/admin/identity", "/api/v1/history", "/api/v1/history/{report_id}", "/api/v1/account/preferences", "/api/v1/account/export", "/api/v1/feedback"} | {
            '/api/v1/admin/overview','/api/v1/admin/feedback','/api/v1/admin/feedback/{record_id}',
            '/api/v1/admin/organizations','/api/v1/admin/organizations/{record_id}',
            '/api/v1/admin/domains','/api/v1/admin/domains/{record_id}','/api/v1/admin/domains/{record_id}/review',
            '/api/v1/admin/articles','/api/v1/admin/articles/{record_id}','/api/v1/admin/articles/{record_id}/status',
            '/api/v1/admin/audit','/api/v1/education','/api/v1/education/{slug}',
        }


def test_startup_without_supabase(settings, monkeypatch):
    for name in list(os.environ):
        if any(part in name.upper() for part in ["SUPABASE", "JWT", "DATABASE"]):
            monkeypatch.delenv(name)
    with TestClient(create_app(settings)) as client:
        assert client.get("/health").status_code == 200


def test_production_docs_and_debug(settings):
    production = settings.model_copy(update={"app_env": "production"})
    with TestClient(create_app(production)) as client:
        assert client.get("/health").status_code == 200
        for path in ["/docs", "/redoc", "/openapi.json"]:
            assert client.get(path).status_code == 404
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production", app_debug=True)


def test_cors(settings):
    with TestClient(create_app(settings)) as client:
        for origin in settings.cors_origins:
            headers = {"Origin": origin}
            assert client.get("/health", headers=headers).headers["access-control-allow-origin"] == origin
            response = client.options("/health", headers={**headers, "Access-Control-Request-Method": "GET"})
            assert response.status_code == 200
            assert "access-control-allow-credentials" not in response.headers
        assert "access-control-allow-origin" not in client.get(
            "/health", headers={"Origin": "https://untrusted.example"},
        ).headers
        for headers in [
            {"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"},
            {"Origin": settings.cors_origins[0], "Access-Control-Request-Method": "PUT"},
        ]:
            assert client.options("/health", headers=headers).status_code == 400


@pytest.mark.parametrize("origins", ["*", "null", "ftp://localhost", "https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1", "https://example.com#x", "http://localhost:99999", "http://local host", "http://localhost:5173,", "http://localhost:", "https://example.com\\evil"])
def test_invalid_origins(origins):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=origins)


def test_environment_parsing(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com/, http://localhost:5173,https://example.com:443")
    monkeypatch.setenv("PORT", "8123")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("APP_DEBUG", "false")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["https://example.com", "http://localhost:5173"]
    assert settings.port == 8123


def test_ipv6_and_international_origins():
    settings = Settings(_env_file=None, cors_origins="http://[::1]:5173,https://bücher.example")
    assert settings.cors_origins == ["http://[::1]:5173", "https://xn--bcher-kva.example"]


@pytest.mark.parametrize("prefix", ["api/v1", "/", "/api/v1/", "//api", "/api?x", "/health"])
def test_invalid_api_prefix(prefix):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, api_v1_prefix=prefix)


def test_custom_prefix(settings):
    with TestClient(create_app(settings.model_copy(update={"api_v1_prefix": "/api/v2"}))) as client:
        assert client.get("/api/v2/health").status_code == 200
        assert client.get("/api/v1/health").status_code == 404


class Input(BaseModel):
    count: int


def test_errors_do_not_expose_input_or_exception(settings):
    app = create_app(settings)
    # Test-only routes exercise handlers without adding production features.
    api = app.app

    @api.post("/test-validation")
    async def validate(payload: Input):
        return payload

    @api.get("/test-http")
    async def http_failure():
        raise HTTPException(401, "secret-http-detail", headers={"WWW-Authenticate": "Bearer"})

    @api.get("/test-error")
    async def internal_failure():
        raise RuntimeError("secret-exception-detail")

    class Capture(logging.Handler):
        records = []

        def emit(self, record):
            self.records.append(record.getMessage())

    capture = Capture()
    logger = logging.getLogger("awasin")
    logger.addHandler(capture)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            cases = [
                (client.get("/missing"), 404, "http_error"),
                (client.post("/health"), 405, "http_error"),
                (client.get("/test-http"), 401, "http_error"),
                (client.post("/test-validation", json={"count": "secret-input"}), 422, "validation_error"),
                (client.get("/test-error", headers={"Origin": settings.cors_origins[0]}), 500, "internal_error"),
            ]
            for response, status, code in cases:
                assert response.status_code == status
                assert response.json()["error"]["code"] == code
                assert "secret" not in response.text
            assert cases[2][0].headers["www-authenticate"] == "Bearer"
            assert cases[-1][0].headers["access-control-allow-origin"] == settings.cors_origins[0]
        assert any("RuntimeError" in record for record in capture.records)
        assert all("secret" not in record for record in capture.records)
    finally:
        logger.removeHandler(capture)


def test_server_exception_format_is_redacted():
    try:
        raise RuntimeError("secret-server-error")
    except RuntimeError:
        record = logging.LogRecord("uvicorn.error", logging.ERROR, __file__, 1, "Exception in ASGI application", (), sys.exc_info())
    output = SafeFormatter("%(levelname)s %(message)s").format(record)
    assert "RuntimeError" in output
    assert "secret" not in output
