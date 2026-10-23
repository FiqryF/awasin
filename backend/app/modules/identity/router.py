from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.exceptions import HTTPException

from app.modules.identity.service import Identity, IdentityService, Profile, ProfileUpdate, unauthorized

router = APIRouter(tags=["Identity"])
bearer = HTTPBearer(auto_error=False)


def service(request: Request) -> IdentityService:
    return request.app.state.identity


def access_token(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> str:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    return credentials.credentials


async def current_user(
    token: Annotated[str, Depends(access_token)], provider: Annotated[IdentityService, Depends(service)],
) -> Identity:
    return await provider.resolve(token)


def administrator(identity: Annotated[Identity, Depends(current_user)]) -> Identity:
    if identity.role != "admin":
        raise HTTPException(403)
    return identity


@router.get("/auth/me")
def me(response: Response, identity: Annotated[Identity, Depends(current_user)]) -> Identity:
    response.headers["Cache-Control"] = "no-store"
    return identity


@router.patch("/profiles/me")
async def update_me(
    payload: ProfileUpdate, response: Response,
    token: Annotated[str, Depends(access_token)],
    identity: Annotated[Identity, Depends(current_user)],
    provider: Annotated[IdentityService, Depends(service)],
) -> Profile:
    response.headers["Cache-Control"] = "no-store"
    return await provider.update_profile(token, identity, payload)


@router.get("/admin/identity")
def admin_identity(response: Response, identity: Annotated[Identity, Depends(administrator)]) -> Identity:
    response.headers["Cache-Control"] = "no-store"
    return identity
