import json
import time
from uuid import uuid4

from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
import httpx
import jwt
from pydantic import SecretStr, ValidationError
import pytest

from app.main import create_app
from app.core.config import Settings
from app.modules.identity.service import IdentityService


@pytest.fixture
def identity_api(settings):
    key = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()))
    public.update(kid="test-key", alg="ES256", use="sig")
    user_id, session_id = str(uuid4()), str(uuid4())
    now = int(time.time())
    claims = {"sub": user_id, "session_id": session_id, "iss": "https://awasin-test.supabase.co/auth/v1", "aud": "authenticated", "role": "authenticated", "exp": now + 300, "iat": now, "aal": "aal1"}
    state = {"role": "user", "confirmed": True, "profile_id": user_id, "provider_status": 200, "jwks_calls": 0, "name": "Test user", "keys": [public], "active_session": True}
    configured = settings.model_copy(update={"supabase_url": "https://awasin-test.supabase.co", "supabase_publishable_key": SecretStr("test-only-public-key")})

    def respond(request):
        assert request.url.host == "awasin-test.supabase.co"
        if state["provider_status"] != 200:
            return httpx.Response(state["provider_status"])
        path = request.url.path
        if path.endswith("jwks.json"):
            state["jwks_calls"] += 1
            return httpx.Response(200, json={"keys": state["keys"]})
        assert request.headers.get("authorization", "").startswith("Bearer ")
        if path == "/auth/v1/user":
            return httpx.Response(200, json={"id": user_id, "email": "local@example.invalid", "email_confirmed_at": "2026-01-01" if state["confirmed"] else None, "user_metadata": {"role": "admin"}})
        if path == "/rest/v1/user_roles":
            assert request.url.params["user_id"] == f"eq.{user_id}"
            return httpx.Response(200, json=[{"role": state["role"]}] if state["active_session"] else [])
        if path == "/rest/v1/profiles":
            assert request.url.params["id"] == f"eq.{user_id}"
            if request.method == "PATCH":
                payload = json.loads(request.content)
                assert set(payload) == {"display_name"}
                state["name"] = payload["display_name"]
                return httpx.Response(204)
            return httpx.Response(200, json=[{"id": state["profile_id"], "display_name": state["name"]}])
        raise AssertionError("Unexpected provider path")

    def token(changes=None, signing_key=None, algorithm="ES256", headers=None):
        payload = {**claims, **(changes or {})}
        return jwt.encode(payload, signing_key or key, algorithm=algorithm, headers={"kid": "test-key", **(headers or {})})

    app = create_app(configured)
    provider_client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with TestClient(app, raise_server_exceptions=False) as client:
        service = IdentityService(configured, provider_client)
        app.app.state.identity = service
        yield client, token, state, service, key
        client.portal.call(provider_client.aclose)


def test_protected_requests_and_current_role(identity_api):
    client, token, state, _, _ = identity_api
    for path in ["/api/v1/auth/me", "/api/v1/admin/identity"]:
        assert client.get(path).status_code == 401
    headers = {"Authorization": f"Bearer {token()}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["role"] == "user"  # editable metadata was admin
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/api/v1/admin/identity", headers=headers).status_code == 403
    state["role"] = "admin"
    assert client.get("/api/v1/admin/identity", headers=headers).status_code == 200
    aal2 = {"Authorization": f"Bearer {token({'aal': 'aal2'})}"}
    assert client.get("/api/v1/admin/identity", headers=aal2).status_code == 200
    state["role"] = "user"  # same JWT must lose admin immediately
    assert client.get("/api/v1/admin/identity", headers=aal2).status_code == 403
    state["active_session"] = False
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


@pytest.mark.parametrize("changes", [
    {"exp": 1}, {"exp": "9999999999"}, {"iss": "https://other.supabase.co/auth/v1"},
    {"aud": "anon"}, {"aud": ["authenticated"]}, {"sub": "not-uuid"}, {"session_id": "bad"},
    {"role": "service_role"}, {"aal": "aal3"}, {"is_anonymous": True}, {"iat": 9999999999},
    {"exp": None}, {"aal": None},
])
def test_invalid_claims(identity_api, changes):
    client, token, _, _, _ = identity_api
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token(changes)}"})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_invalid_signatures_algorithms_and_key_headers(identity_api):
    client, token, _, _, _ = identity_api
    bad_key = ec.generate_private_key(ec.SECP256R1())
    samples = ["malformed", token(signing_key=bad_key), token(algorithm="HS256", signing_key=b"test-key-generated-for-invalid-algorithm"), token(headers={"kid": "unknown"}), token(headers={"typ": "OTHER"})]
    for value in samples:
        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {value}"}).status_code == 401


def test_profile_ownership_and_no_privilege_updates(identity_api):
    client, token, state, _, _ = identity_api
    headers = {"Authorization": f"Bearer {token()}"}
    assert client.patch("/api/v1/profiles/me", headers=headers, json={"display_name": "New name"}).status_code == 200
    assert state["name"] == "New name"
    for patch in [{"role": "admin"}, {"id": str(uuid4())}, {"display_name": " "}, {"display_name": "x" * 101}]:
        assert client.patch("/api/v1/profiles/me", headers=headers, json=patch).status_code == 422
    assert client.get(f"/api/v1/profiles/{uuid4()}", headers=headers).status_code == 404
    state["profile_id"] = str(uuid4())
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 503


def test_unconfirmed_account_and_provider_failure(identity_api):
    client, token, state, _, _ = identity_api
    headers = {"Authorization": f"Bearer {token()}"}
    state["confirmed"] = False
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    state["confirmed"] = True
    state["provider_status"] = 500
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 503
    assert "test-only-public-key" not in response.text


def test_bounded_key_cache_rotation(identity_api):
    client, token, state, service, _ = identity_api
    headers = {"Authorization": f"Bearer {token()}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    for _ in range(4):
        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token(headers={'kid': 'missing'})}"}).status_code == 401
    assert state["jwks_calls"] == 1
    rotated = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(rotated.public_key()))
    public.update(kid="rotated", alg="ES256", use="sig")
    state["keys"] = [public]
    service.fetched = time.monotonic() - 31
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token(signing_key=rotated, headers={'kid': 'rotated'})}"}).status_code == 200
    service.fetched = time.monotonic() - 301
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_unconfigured_auth_fails_closed(settings):
    with TestClient(create_app(settings)) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer anything"}).status_code == 503


def test_cors_authorization_header_and_patch(settings):
    with TestClient(create_app(settings)) as client:
        response = client.options("/api/v1/profiles/me", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "authorization,content-type"})
        assert response.status_code == 200
        assert "access-control-allow-credentials" not in response.headers


def test_reject_legacy_algorithm_configuration():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, supabase_jwt_algorithm="HS256")


def test_secret_key_rejection_does_not_expose_input():
    sensitive = "sb_secret_" + str(uuid4())
    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None, supabase_publishable_key=sensitive)
    assert sensitive not in str(exc.value)


def test_blank_publishable_key_keeps_health_available():
    settings = Settings(_env_file=None, supabase_publishable_key="")
    assert settings.supabase_publishable_key is None
