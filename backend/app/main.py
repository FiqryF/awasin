
"""ASGI application factory. Run from backend with python -m app."""

from contextlib import asynccontextmanager
import logging
from pathlib import Path
from app.modules.analysis.message import MessageAnalyzer
from app.modules.analysis.message_ocr import MessageOCR

import httpx
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from app.api.v1.router import router as api_router
from app.core.config import Settings
from app.core.exceptions import ErrorResponse, register_exception_handlers
from app.core.logging import configure_logging
from app.modules.health.router import APP_VERSION, router as health_router
from app.modules.identity.service import IdentityService
from app.modules.feedback.router import FeedbackLimiter
from app.modules.analysis.orchestrator import AnalysisOrchestrator
from app.modules.analysis.ai_analyst import SecurityAnalyst
from app.modules.analysis.threat_detector import ThreatDetector
from app.modules.analysis.openrouter_detector import FREE_MODEL, OpenRouterDetector
from app.modules.analysis.ai_tickets import ExplanationTickets
from app.modules.analysis.inspect_url import UrlInspector
from app.modules.analysis.historical import DomainIntelligence, Urlscan, VirusTotal
from app.modules.analysis.vtai import VirusTotalAI, load_vtai_token
from app.modules.analysis.registry import load_registry
from app.modules.analysis.safe_browsing import SafeBrowsing
from app.modules.analysis.url import ThreatIntelligenceProvider
from app.modules.analysis.web_risk import WebRisk
from app.core.body_limit import RequestBodyLimit


def create_app(settings: Settings | None = None) -> ASGIApp:
    settings = settings if settings is not None else Settings()
    logger = configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(api: FastAPI):
        async with httpx.AsyncClient(
            timeout=5,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            api.state.identity = IdentityService(settings, client)
            api.state.feedback_limiter = FeedbackLimiter()
            api.state.security_analyst = SecurityAnalyst(settings)

            # OpenRouter Detector and optional AI fallback.
            openrouter_key = (
                settings.openrouter_api_key.get_secret_value().strip()
                if settings.openrouter_api_key
                else ""
            )
            detector_model = settings.openrouter_detector_model.strip()
            detector_provider = None

            if (
                settings.ai_threat_detector_enabled
                and openrouter_key
                and FREE_MODEL.fullmatch(detector_model)
            ):
                detector_provider = OpenRouterDetector(
                    openrouter_key,
                    detector_model,
                )

            api.state.threat_detector = ThreatDetector(
                settings.ai_threat_detector_enabled,
                detector_provider,
            )
            api.state.backup_analyst = (
                SecurityAnalyst(
                    settings,
                    detector_provider,
                    openrouter=True,
                )
                if detector_provider
                else None
            )

            api.state.explanation_tickets = ExplanationTickets()
            api.state.detector_tickets = ExplanationTickets()

            # Primary threat intelligence.
            safe_key = (
                settings.google_safe_browsing_api_key
                or settings.safe_browsing_api_key
            )
            web_key = settings.web_risk_api_key
            provider: ThreatIntelligenceProvider | None = None

            if safe_key and safe_key.get_secret_value().strip():
                provider = SafeBrowsing(
                    client,
                    safe_key.get_secret_value().strip(),
                )
            elif (
                settings.web_risk_enabled
                and web_key
                and web_key.get_secret_value().strip()
            ):
                provider = WebRisk(
                    client,
                    web_key.get_secret_value().strip(),
                )

            # Prevent HTTP logs from exposing sensitive request data.
            for name in ("httpx", "httpcore"):
                logging.getLogger(name).setLevel(logging.WARNING)

            # Existing VirusTotal and urlscan.io integrations.
            vt_key = (
                settings.virustotal_api_key.get_secret_value().strip()
                if settings.virustotal_api_key
                else ""
            )
            urlscan_key = (
                settings.urlscan_api_key.get_secret_value().strip()
                if settings.urlscan_api_key
                else ""
            )

            # VirusTotal AI (VTAI) integration.
            # Token is loaded from an environment variable or
            # ~/.config/vtai/token. Never expose it to the frontend.
            vtai_token = load_vtai_token(settings) if settings.vtai_enabled else ""

            vtai_provider = (
                VirusTotalAI(client, vtai_token)
                if vtai_token
                else None
            )

            if settings.vtai_enabled and not vtai_provider and settings.app_env != "test":
                logger.warning(
                    "VirusTotal AI enabled but token unavailable"
                )

            # Verified domain references.
            registry = ()

            if settings.verified_domain_snapshot:
                try:
                    registry = load_registry(
                        Path(settings.verified_domain_snapshot)
                    )
                except (
                    OSError,
                    ValueError,
                    TypeError,
                    KeyError,
                    AttributeError,
                    RecursionError,
                ):
                    logger.warning(
                        "Verified domain snapshot unavailable"
                    )

            api.state.detector_domain_references = registry

            # Main analysis orchestrator.
            api.state.analysis = AnalysisOrchestrator(
                {
                    "link": UrlInspector(
                        provider,
                        virustotal=(
                            VirusTotal(client, vt_key)
                            if vt_key
                            else None
                        ),
                        vtai=vtai_provider,
                        urlscan=(
                            Urlscan(client, urlscan_key)
                            if urlscan_key
                            else None
                        ),
                        domain_intelligence=DomainIntelligence(client),
                        registry=registry,
                    )
                },
                timeout=16,
            )
            api.state.analysis.adapters['message'] = MessageAnalyzer(
                api.state.security_analyst, api.state.analysis.adapters['link'],
                MessageOCR(settings.tesseract_cmd, Path(settings.tesseract_data_dir) if settings.tesseract_data_dir else None),
                backup_analyst=api.state.backup_analyst,
            )

            yield

    api = FastAPI(
        title=settings.app_name,
        version=APP_VERSION,
        description=(
            "AWASIN account, history, feedback "
            "and shared security analysis API."
        ),
        lifespan=lifespan,
        debug=False,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        responses={
            422: {"model": ErrorResponse},
            500: {"model": ErrorResponse},
        },
    )

    api.state.settings = settings

    register_exception_handlers(api, logger)
    api.include_router(health_router)
    api.include_router(
        api_router,
        prefix=settings.api_v1_prefix,
    )

    api.add_middleware(
        RequestBodyLimit,
        prefix=settings.api_v1_prefix,
    )

    return CORSMiddleware(
        api,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "PATCH", "POST", "DELETE"],
        allow_headers=[
            "Accept",
            "Content-Type",
            "Authorization",
        ],
    )
