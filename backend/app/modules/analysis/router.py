import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Coroutine, TypeVar

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
from app.modules.identity.preferences import read_preferences
from app.modules.history.schemas import ReportDetail
from app.modules.history.service import HistoryService

from .orchestrator import AnalysisInput, AnalysisOrchestrator
from .message import MessageAnalyzer
from .ai_schema import AIExplanation, AIOffer, AIRequest, AIUrlAnalysis, DetectorResult
from .ai_tickets import Binding, digest
from .ai_validator import explain
from .ai_analyst import UrlAnalystInput, minimize_evidence, url_for_analyst
from .threat_detector import build_input
from .schemas import AnalysisResponse, MediaMode, MediaRequest, MessageRequest, TextRequest, UrlRequest
from .url import parse_url
from .validation import IMAGE_LIMIT, VIDEO_LIMIT, checked_text, validate_media

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


def explanation_binding(request: Request, identity: Identity | None) -> Binding:
    if identity:
        token = request.headers.get("authorization", "").partition(" ")[2].strip()
        return Binding(subject=f"user:{identity.id}", session=digest(token))
    host = request.client.host if request.client else ""
    return Binding(subject=f"anonymous:{host}", session="")


def admit_message(engine: AnalysisOrchestrator, request: Request, identity: Identity | None):
    analyzer = engine.adapters.get('message')
    if isinstance(analyzer, MessageAnalyzer) and not analyzer.admit(explanation_binding(request, identity).subject):
        raise HTTPException(429, headers={'Retry-After': '60'})


def url_history_report(result: AnalysisResponse) -> ReportDetail | None:
    if not result.provenance or not result.url_report:
        return None
    risk = 'inconclusive' if result.risk == 'unknown' else result.risk
    domain = result.url_report.registered_domain
    return ReportDetail(
        id=result.analysis_id, mode=result.mode, created_at=result.checked_at, saved_at=result.checked_at,
        safe_label=domain[:160] if domain else 'Pemeriksaan tautan', status='completed', risk=risk,
        engine=result.provenance.engine[:120], engine_version=result.provenance.version[:80], analyzed_at=result.checked_at,
        result={'risk': risk, 'findings': [{'title': 'Ringkasan', 'description': result.explanation}],
                'recommendations': result.url_report.recommendations},
    )


async def save_message_history(request: Request, identity: Identity | None, data: AnalysisInput, result: AnalysisResponse):
    report = result.message_report
    if not identity or not data.history_consent or not report or not result.provenance or report.ocr_status not in {'not_requested', 'completed', 'low_confidence', 'truncated'}:
        return
    risk = 'inconclusive' if result.risk == 'unknown' else result.risk
    settings = request.app.state.settings
    engine, version = result.provenance.engine, result.provenance.version
    if report.ai_status == 'completed':
        engine, version = ('Nemotron', settings.openrouter_detector_model[:80]) if report.analyst == 'nemotron' else (
            'Mistral', settings.mistral_model
        )
    record = ReportDetail(
        id=result.analysis_id, mode='message', created_at=result.checked_at, saved_at=result.checked_at,
        safe_label='Pemeriksaan pesan', status='completed', risk=risk,
        engine=engine, engine_version=version,
        analyzed_at=result.checked_at,
        result={'risk': risk, 'findings': [{'title': 'Ringkasan', 'description': result.explanation}],
                'recommendations': report.recommendations},
    )
    result.history_status = await record_url_history(request, identity, record)


async def record_url_history(request: Request, identity: Identity, report: ReportDetail, result: AIExplanation | None = None):
    provider = request.app.state.identity
    token = request.headers['authorization'].partition(' ')[2].strip()
    history = HistoryService(provider, token, identity)
    try:
        if (await read_preferences(provider, token, identity)).history_retention == 'disabled':
            return 'disabled'
        if not history.write_key():
            return 'unconfigured'
        if isinstance(result, AIUrlAnalysis) and result.status == 'completed':
            risk = 'inconclusive' if result.risk == 'unknown' else result.risk
            report = report.model_copy(update={
                'risk': risk, 'engine': 'Nemotron' if result.analyst == 'nemotron' else 'Mistral',
                'engine_version': provider.settings.openrouter_detector_model if result.analyst == 'nemotron' else provider.settings.mistral_model,
                'result': report.result.model_copy(update={'risk': risk, 'recommendations': result.recommendations,
                    'findings': [report.result.findings[0].model_copy(update={'description': result.summary or report.result.findings[0].description})]}),
            })
        await history.record_url(report)
    except HTTPException:
        return 'unavailable'
    return 'saved'


@router.post("", response_model=AnalysisResponse, openapi_extra={"security": [{}]})
async def analyze(payload: TextRequest, request: Request, response: Response, identity: Actor, engine: Orchestrator):
    response.headers["Cache-Control"] = "no-store"
    try:
        context = input_context(payload, identity)
        if isinstance(payload, UrlRequest):
            target = parse_url(payload.url, allow_domain=payload.mode == "website")
            data = AnalysisInput(
                **context, url=target.normalized_url, url_target=target,
                threat_lookup_consent=payload.threat_lookup_consent,
                enhanced_lookup_consent=payload.enhanced_lookup_consent,
            )
        elif isinstance(payload, MessageRequest):
            data = AnalysisInput(**context, text=checked_text(payload.text, 10),
                                 message_ai_consent=payload.message_ai_consent, message_link_consent=payload.message_link_consent,
                                 message_openrouter_consent=payload.message_openrouter_consent,
                                 message_link_enhanced_consent=payload.message_link_enhanced_consent)
            admit_message(engine, request, identity)
        else:
            qr_payload = checked_text(payload.payload, 1)
            candidate = qr_payload.strip()
            if candidate.lower().startswith(("http:", "https:")):
                target = parse_url(candidate)
            else:
                try:
                    target = parse_url(candidate, allow_domain=True)
                except ValueError:
                    target = None
            data = AnalysisInput(**context, qr_payload=qr_payload, url=target.normalized_url if target else None, url_target=target)
    except ValueError:
        raise HTTPException(422) from None
    async with analysis_slot(engine):
        result = await engine.run(data)
    if isinstance(payload, UrlRequest) and result.url_report and result.processing == "real":
        history_report = url_history_report(result) if identity and data.history_consent else None
        result = await attach_ai_results(result, payload, data, request, identity, history_report)
        if identity and history_report and not (payload.url_ai_consent and result.ai and result.ai.status == 'pending'):
            result.history_status = await record_url_history(request, identity, history_report)
    elif isinstance(payload, MessageRequest):
        await save_message_history(request, identity, data, result)
    return result


async def attach_ai_results(result: AnalysisResponse, payload: UrlRequest, data: AnalysisInput, request: Request, identity: Identity | None, history_report: ReportDetail | None = None):
    if not (payload.ai_consent or payload.url_ai_consent or payload.detector_consent):
        return result
    assessment = minimize_evidence(result)
    binding = explanation_binding(request, identity)
    if payload.detector_consent and not payload.url_ai_consent and data.url_target:
        detector = request.app.state.threat_detector
        detector_input = build_input(data.url_target, assessment, request.app.state.detector_domain_references)
        if payload.defer_detector:
            if not detector.enabled:
                result.detector = DetectorResult(status="disabled")
            elif detector.provider is None:
                result.detector = DetectorResult(status="unavailable")
            else:
                result.detector_offer = request.app.state.detector_tickets.issue(detector_input, binding)
        else:
            result.detector = await while_connected(request, detector.detect(detector_input, binding.subject, consent=True))
            if result.detector is None:
                return result
            observations = [item.category for item in result.detector.findings if item.assessment == "observed"]
            if observations:
                assessment = assessment.model_copy(update={"detector_observations": observations})
    if payload.ai_consent or payload.url_ai_consent:
        analyst = request.app.state.security_analyst
        if not analyst.settings.awasin_ai_enabled:
            result.ai = AIOffer(status="disabled")
        elif not analyst.configured() and not (
            payload.url_ai_consent and payload.openrouter_fallback_consent and request.app.state.backup_analyst
        ):
            result.ai = AIOffer(status="unavailable")
        else:
            if payload.url_ai_consent and data.url_target:
                assessment = UrlAnalystInput(
                    **assessment.model_dump(),
                    url=url_for_analyst(data.url_target.normalized_url),
                    registered_domain=data.url_target.registered_domain,
                    openrouter_fallback_consent=payload.openrouter_fallback_consent,
                    history_report=history_report,
                )
            result.ai = request.app.state.explanation_tickets.issue(
                assessment, binding,
            )
    return result


async def wait_for_disconnect(request: Request) -> None:
    while (await request.receive())["type"] != "http.disconnect":
        pass


T = TypeVar("T")


async def while_connected(request: Request, operation: Coroutine[None, None, T]) -> T | None:
    generation = asyncio.create_task(operation)
    disconnect = asyncio.create_task(wait_for_disconnect(request))
    try:
        done, _ = await asyncio.wait((generation, disconnect), return_when=asyncio.FIRST_COMPLETED)
        return generation.result() if generation in done else None
    finally:
        for task in (generation, disconnect):
            if not task.done():
                task.cancel()
        await asyncio.gather(generation, disconnect, return_exceptions=True)


@router.post("/explanation", response_model=AIUrlAnalysis | AIExplanation, openapi_extra={"security": [{}]})
async def analyze_explanation(payload: AIRequest, request: Request, response: Response, identity: Actor):
    response.headers["Cache-Control"] = "no-store"
    if not payload.consent:
        return AIExplanation(status="not_requested")
    analyst = request.app.state.security_analyst
    if not analyst.settings.awasin_ai_enabled:
        return AIExplanation(status="disabled")
    assessment = request.app.state.explanation_tickets.consume(
        payload.ticket, explanation_binding(request, identity),
    )
    if assessment is None:
        return AIExplanation(status="unavailable")
    async def analyze_with_fallback():
        result = await explain(analyst, assessment, consent=True)
        backup = request.app.state.backup_analyst
        if (isinstance(assessment, UrlAnalystInput) and assessment.openrouter_fallback_consent and backup
                and result.status in {"unavailable", "rate_limited", "timeout", "validation_failed"}):
            alternate = await explain(backup, assessment, consent=True)
            if isinstance(alternate, AIUrlAnalysis) and alternate.status == "completed":
                return alternate.model_copy(update={"analyst": "nemotron"})
            if alternate.status in {"unavailable", "rate_limited", "timeout", "validation_failed"}:
                return result.model_copy(update={"fallback_status": alternate.status})
        return result

    result = await while_connected(request, analyze_with_fallback())
    if result is not None and identity and isinstance(assessment, UrlAnalystInput) and assessment.history_report:
        result.history_status = await record_url_history(request, identity, assessment.history_report, result)
    return result if result is not None else AIExplanation(status="unavailable")


@router.post("/detector", response_model=DetectorResult, openapi_extra={"security": [{}]})
async def analyze_detector(payload: AIRequest, request: Request, response: Response, identity: Actor):
    response.headers["Cache-Control"] = "no-store"
    binding = explanation_binding(request, identity)
    if not payload.consent:
        return DetectorResult(status="unavailable")
    detector_input = request.app.state.detector_tickets.consume(payload.ticket, binding)
    if detector_input is None:
        return DetectorResult(status="unavailable")
    detector = request.app.state.threat_detector
    result = await while_connected(request, detector.detect(detector_input, binding.subject, consent=True))
    return result if result is not None else DetectorResult(status="unavailable")


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
    if mode == 'message':
        admit_message(engine, request, identity)
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
            data = AnalysisInput(
                **input_context(payload, identity), text=text, media=media, media_stream=file.file,
                message_ai_consent=payload.message_ai_consent, message_link_consent=payload.message_link_consent,
                message_openrouter_consent=payload.message_openrouter_consent,
                message_link_enhanced_consent=payload.message_link_enhanced_consent,
            )
            result = await engine.run(data)
        finally:
            await form.close()
    if mode == 'message':
        await save_message_history(request, identity, data, result)
    return result
