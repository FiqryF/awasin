import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from anyio import WouldBlock, to_thread
from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from python_multipart.exceptions import MultipartParseError
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.formparsers import MultiPartException, MultiPartParser
from starlette.requests import ClientDisconnect

from app.modules.identity.router import access_token, bearer, service
from app.modules.identity.service import Identity, IdentityService, unauthorized

from .orchestrator import AnalysisInput, AnalysisOrchestrator
from .schemas import AnalysisResponse, MediaMode, MediaRequest, MessageRequest, TextRequest, UrlRequest
from .validation import IMAGE_LIMIT, VIDEO_LIMIT, checked_text, public_url, validate_media

router = APIRouter(prefix="/analysis", tags=["Analysis"])
FORM_OVERHEAD = 64 * 1024
UPLOAD_TIMEOUT = 15


async def optional_identity(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    provider: Annotated[IdentityService, Depends(service)],
) -> Identity | None:
    authorization = request.headers.getlist("authorization")
    if not authorization:
        return None
    if len(authorization) != 1:
        raise unauthorized()
    token = access_token(credentials)
    if any(char.isspace() for char in token):
        raise unauthorized()
    return await provider.resolve(token)


def orchestrator(request: Request) -> AnalysisOrchestrator:
    return request.app.state.analysis


Actor = Annotated[Identity | None, Depends(optional_identity)]
Orchestrator = Annotated[AnalysisOrchestrator, Depends(orchestrator)]


@asynccontextmanager
async def analysis_slot(engine: AnalysisOrchestrator) -> AsyncIterator[None]:
    try:
        engine.capacity.acquire_nowait()
    except WouldBlock:
        raise HTTPException(429, headers={"Retry-After": "2"}) from None
    try:
        yield
    finally:
        engine.capacity.release()


def input_context(payload: TextRequest | MediaRequest, identity: Identity | None) -> dict:
    return {
        "mode": payload.mode,
        "request_id": payload.request_id,
        "owner_id": str(identity.id) if identity else None,
        "history_consent": payload.history_consent and identity is not None,
    }


@router.post("", response_model=AnalysisResponse, openapi_extra={"security": [{}]})
async def analyze(payload: TextRequest, response: Response, identity: Actor, engine: Orchestrator):
    response.headers["Cache-Control"] = "no-store"
    try:
        context = input_context(payload, identity)
        if isinstance(payload, UrlRequest):
            data = AnalysisInput(**context, url=public_url(payload.url, allow_domain=payload.mode == "website"))
        elif isinstance(payload, MessageRequest):
            data = AnalysisInput(**context, text=checked_text(payload.text, 10))
        else:
            qr_payload = checked_text(payload.payload, 1)
            candidate = qr_payload.strip()
            url = public_url(candidate) if candidate.lower().startswith(("http:", "https:")) else None
            data = AnalysisInput(**context, qr_payload=qr_payload, url=url)
    except ValueError:
        raise HTTPException(422) from None
    async with analysis_slot(engine):
        return await engine.run(data)


async def bounded_body(request: Request, limit: int) -> AsyncIterator[bytes]:
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise MultiPartException("Request too large")
        yield chunk


class AnalysisFormParser(MultiPartParser):
    finished = False

    def on_end(self) -> None:
        self.finished = True


@router.post(
    "/media/{mode}",
    response_model=AnalysisResponse,
    openapi_extra={"security": [{}], "requestBody": {"required": True, "content": {"multipart/form-data": {
        "schema": {"type": "object", "required": ["file"], "properties": {
            "file": {"type": "string", "format": "binary"},
            "metadata": {"type": "string", "description": "JSON object with mode and optional text, request_id and history_consent"},
        }},
    }}}},
)
async def analyze_media(mode: MediaMode, request: Request, response: Response, identity: Actor, engine: Orchestrator):
    response.headers["Cache-Control"] = "no-store"
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "multipart/form-data":
        raise HTTPException(415)
    file_limit = VIDEO_LIMIT if mode == "video" else IMAGE_LIMIT
    limit = file_limit + FORM_OVERHEAD
    length = request.headers.get("content-length")
    if length is not None:
        if not length.isascii() or not length.isdecimal() or len(length) > 12:
            raise HTTPException(400)
        if int(length) > limit:
            raise HTTPException(413)
    async with analysis_slot(engine):
        parser = AnalysisFormParser(
            request.headers, bounded_body(request, limit), max_files=1, max_fields=1, max_part_size=FORM_OVERHEAD,
        )
        try:
            async with asyncio.timeout(UPLOAD_TIMEOUT):
                form = await parser.parse()
        except TimeoutError:
            raise HTTPException(408) from None
        except MultiPartException as exc:
            raise HTTPException(413 if exc.message == "Request too large" else 422) from None
        except (MultipartParseError, ClientDisconnect, ValueError):
            raise HTTPException(422) from None
        try:
            file = form.get("file")
            metadata = form.get("metadata", f'{{"mode":"{mode}"}}')
            if not parser.finished or not isinstance(file, UploadFile) or not isinstance(metadata, str) or set(form) - {"file", "metadata"}:
                raise HTTPException(422)
            size = file.size or 0
            if size > file_limit:
                raise HTTPException(413)
            try:
                payload = MediaRequest.model_validate_json(metadata)
                if payload.mode != mode:
                    raise ValueError("Mode mismatch")
                text = checked_text(payload.text, 1) if payload.text is not None else None
                media = await to_thread.run_sync(
                    lambda: validate_media(file.file, file.content_type or "", size, video=mode == "video")
                )
            except (ValidationError, ValueError):
                raise HTTPException(422) from None
            return await engine.run(AnalysisInput(
                **input_context(payload, identity), text=text, media=media, media_stream=file.file,
            ))
        finally:
            await form.close()
