"""No administrative keys: every data request uses the verified user's JWT."""

import asyncio
import time
from typing import Literal
from uuid import UUID

import httpx
import jwt
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.exceptions import HTTPException

from app.core.config import Settings


class Claims(BaseModel):
    model_config = ConfigDict(strict=True)
    sub: str
    iss: str
    aud: Literal["authenticated"]
    role: Literal["authenticated"]
    exp: int
    iat: int
    session_id: str
    aal: Literal["aal1", "aal2"]
    is_anonymous: Literal[False] = False


class Profile(BaseModel):
    id: UUID
    display_name: str


class Identity(BaseModel):
    id: UUID
    email: str
    role: Literal["user", "admin"]
    aal: Literal["aal1", "aal2"]
    profile: Profile


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=100, pattern=r"\S")


def unauthorized() -> HTTPException:
    return HTTPException(401, headers={"WWW-Authenticate": "Bearer"})


class IdentityService:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.settings = settings
        self.client = client
        self.keys: dict[str, jwt.PyJWK] = {}
        self.fetched = float("-inf")
        self.lock = asyncio.Lock()

    async def signing_key(self, kid: str) -> jwt.PyJWK:
        # One bounded cache per worker. Unknown kids cannot trigger a request flood.
        async with self.lock:
            age = time.monotonic() - self.fetched
            if age >= 300 or (kid not in self.keys and age >= 30):
                response = await self.request("GET", "/auth/v1/.well-known/jwks.json")
                try:
                    raw = response.json()["keys"]
                    if not isinstance(raw, list) or len(raw) > 20:
                        raise ValueError("Invalid key set")
                    keys = {}
                    for item in raw:
                        if item.get("alg") == self.settings.supabase_jwt_algorithm and item.get("use", "sig") == "sig":
                            keys[item["kid"]] = jwt.PyJWK.from_dict(item)
                    self.keys = keys
                    self.fetched = time.monotonic()
                except (ValueError, TypeError, KeyError, jwt.PyJWTError):
                    raise HTTPException(503) from None
            if kid not in self.keys:
                raise unauthorized()
            return self.keys[kid]

    async def request(self, method: str, path: str, token: str | None = None, **kwargs) -> httpx.Response:
        if not self.settings.supabase_url or not self.settings.supabase_publishable_key:
            raise HTTPException(503)
        headers = {"apikey": self.settings.supabase_publishable_key.get_secret_value()}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            response = await self.client.request(method, f"{self.settings.supabase_url}{path}", headers=headers, **kwargs)
            if response.status_code in {401, 403}:
                raise unauthorized()
            if not response.is_success or len(response.content) > 1_000_000:
                raise HTTPException(503)
            return response
        except httpx.HTTPError:
            raise HTTPException(503) from None

    async def verify(self, token: str) -> Claims:
        if not self.settings.supabase_url or not self.settings.supabase_publishable_key:
            raise HTTPException(503)
        if len(token) > 16384:
            raise unauthorized()
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != self.settings.supabase_jwt_algorithm or header.get("typ") != "JWT":
                raise unauthorized()
            kid = header.get("kid")
            if not isinstance(kid, str) or not 1 <= len(kid) <= 200:
                raise unauthorized()
            key = await self.signing_key(kid)
            payload = jwt.decode(
                token, key.key, algorithms=[self.settings.supabase_jwt_algorithm],
                issuer=f"{self.settings.supabase_url}/auth/v1", audience="authenticated",
                options={"require": ["sub", "iss", "aud", "exp", "iat", "role", "session_id", "aal"]},
            )
            claims = Claims.model_validate(payload)
            UUID(claims.sub)
            UUID(claims.session_id)
            return claims
        except (jwt.PyJWTError, ValidationError, ValueError, TypeError):
            raise unauthorized() from None

    async def resolve(self, token: str) -> Identity:
        claims = await self.verify(token)
        try:
            # Revalidate account state online; do not authorize from editable metadata.
            user = (await self.request("GET", "/auth/v1/user", token)).json()
            if user.get("id") != claims.sub or not user.get("email_confirmed_at") or user.get("is_anonymous"):
                raise unauthorized()
            params = {"user_id": f"eq.{claims.sub}", "select": "role", "limit": "1"}
            roles = (await self.request("GET", "/rest/v1/user_roles", token, params=params)).json()
            profiles = (await self.request("GET", "/rest/v1/profiles", token, params={"id": f"eq.{claims.sub}", "select": "id,display_name", "limit": "1"})).json()
            if not roles or not profiles:
                raise unauthorized()
            identity = Identity(id=claims.sub, email=user["email"], role=roles[0]["role"], aal=claims.aal, profile=profiles[0])
            if str(identity.profile.id) != claims.sub:
                raise HTTPException(503)
            return identity
        except (ValueError, TypeError, KeyError, IndexError):
            raise HTTPException(503) from None

    async def update_profile(self, token: str, identity: Identity, payload: ProfileUpdate) -> Profile:
        response = await self.request(
            "PATCH", "/rest/v1/profiles", token,
            params={"id": f"eq.{identity.id}"}, json={"display_name": payload.display_name.strip()},
        )
        if response.status_code not in {200, 204}:
            raise HTTPException(503)
        return (await self.resolve(token)).profile
