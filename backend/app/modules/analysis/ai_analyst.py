"""Internal, consent-gated explanation of an already fused deterministic result."""

import asyncio
import json
import re
from time import monotonic
from typing import Annotated, Literal, Protocol
from urllib.parse import unquote

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import Settings
from app.modules.history.schemas import ReportDetail

from .ai_schema import DetectorCategory, DetectorVerdict
from .mistral import MODEL_ID, TIMEOUT_SECONDS, InvalidAnalystResponse, MistralGenerator, MistralHTTPError
from .schemas import AnalysisResponse, EngineResult, Risk

MAX_EVIDENCE = 12
MAX_INPUT_BYTES = 4096
MAX_TEXT_BYTES = 8192
MAX_CONCURRENT = 2
RATE_LIMIT_COOLDOWN = 15
STRUCTURE_CODES = {
    "deep_subdomains", "ip_literal", "nonstandard_port", "long_url", "encoded_components",
    "encoded_controls", "account_path", "redirect_parameter", "mixed_script_hostname",
    "archive_download", "executable_download", "obscured_filename",
}
IDENTITY_CODES = {
    "reference_match": "reference_match",
    "misleading_subdomain": "possible_impersonation",
    "confusable": "possible_impersonation",
    "brand_reference": "name_similarity",
    "near_spelling": "name_similarity",
}
PRIMARY_SOURCES = {"Google Safe Browsing": "google_safe_browsing", "Google Web Risk": "google_web_risk"}
SUPPLEMENTARY_SOURCES = {"VirusTotal": "virustotal", "VirusTotal File": "virustotal_file", "VirusTotal AI": "vtai", "urlscan.io": "urlscan", "DNS": "dns", "RDAP": "rdap"}
Source = Literal[
    "url_structure", "domain_reference", "google_safe_browsing", "google_web_risk",
    "virustotal", "virustotal_file", "vtai", "urlscan", "dns", "rdap",
]
ServiceStatus = Literal["disabled", "not_requested", "unavailable", "rate_limited", "timeout", "invalid_response", "completed"]
class InternalModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)


class AnalystEvidence(InternalModel):
    id: str = Field(pattern=r"^EV-\d{3}$")
    source: Source
    code: str = Field(pattern=r"^[a-z][a-z_]{0,39}$")
    status: str = Field(pattern=r"^[a-z][a-z_]{0,39}$")
    severity: Risk | None = None
    scope: Literal["exact_url", "hostname", "related_domain", "file_hash"] | None = None
    freshness: Literal["recent", "stale", "unknown"] | None = None
    historical_verdict: Literal["malicious", "suspicious", "no_detection", "unknown"] | None = None
    counts: dict[Literal["malicious", "suspicious", "harmless", "undetected"], int] | None = None
    engine_count: int | None = None
    analysis_date: str | None = None


class AnalystInput(InternalModel):
    contract: Literal["10b-c3"] = "10b-c3"
    risk: Risk
    status: Literal["completed", "partial", "inconclusive"]
    website_content_inspected: Literal[False] = False
    evidence: list[AnalystEvidence] = Field(max_length=MAX_EVIDENCE)
    detector_observations: list[DetectorCategory] | None = None
    detector_verdict: DetectorVerdict | None = None


class UrlAnalystInput(AnalystInput):
    url: str
    registered_domain: str | None
    openrouter_fallback_consent: bool = False
    history_report: ReportDetail | None = None


PRIVATE_SEGMENTS = {"token", "tokens", "session", "secret", "key", "invite", "reset", "reset-password", "callback", "oauth", "magic-link"}


def url_for_analyst(normalized_url: str) -> str:
    """Keep recognizable URL structure and omit query, fragment and token-like path segments."""
    origin, separator, path = normalized_url.partition("://")
    authority, _, path = path.partition("/")
    segments = []
    redact_next = False
    for segment in path.partition("?")[0].split("/")[:24]:
        decoded = unquote(unquote(segment))
        if (redact_next or len(segment) > 80
                or not re.fullmatch(r"[a-zA-Z0-9._~-]{0,40}", decoded)
                or re.search(r"\d{6,}|[a-fA-F0-9]{16,}", decoded)):
            segments.append("[redacted]")
        else:
            segments.append(segment)
        redact_next = decoded.casefold() in PRIVATE_SEGMENTS
    return f"{origin}{separator}{authority}/" + "/".join(segments)


def minimize_evidence(result: EngineResult | AnalysisResponse) -> AnalystInput:
    report = result.url_report
    items = []

    def add(source: Source, code: str, status: str, **metadata) -> None:
        if len(items) < MAX_EVIDENCE:
            items.append(AnalystEvidence(id=f"EV-{len(items) + 1:03}", source=source, code=code, status=status, **metadata))

    if report is not None:
        add(PRIMARY_SOURCES[report.threat_provider], "threat_lookup", report.threat_status,
            severity="high" if report.threat_status == "match" else None)
        checks = report.supplementary_checks
        vtai = next((check for check in checks if check.provider == "VirusTotal AI" and check.status == "found"), None)
        duplicate_vt = next((check for check in checks if check.provider == "VirusTotal"
                             and vtai and check.status == "found" and check.specificity == vtai.specificity == "exact_url"
                             and check.observed_at is not None and check.observed_at == vtai.observed_at
                             and check.verdict == vtai.verdict != "unknown"
                             and {"malicious", "suspicious"} <= check.counts.keys() & vtai.counts.keys()
                             and all(check.counts[key] == vtai.counts[key] for key in check.counts.keys() & vtai.counts.keys())), None)
        for check in checks:
            if check is duplicate_vt:
                continue
            contributes = any(
                item.code in {"historical_alert", "file_archive_alert"} and item.severity == "medium"
                and (item.source == check.provider or (check is vtai and duplicate_vt and item.source == duplicate_vt.provider))
                for item in result.evidence
            )
            add(SUPPLEMENTARY_SOURCES[check.provider], "supplementary_lookup", check.status,
                scope=check.specificity, freshness=check.freshness, historical_verdict=check.verdict,
                severity="medium" if contributes else None, counts=check.counts or None,
                engine_count=check.engine_count, analysis_date=check.observed_at.isoformat() if check.observed_at and check.verdict else None)
        for evidence in result.evidence:
            if (evidence.kind == "identity" and evidence.validation == "verified"
                    and IDENTITY_CODES.get(evidence.code) == report.identity_status):
                add("domain_reference", evidence.code, "observed", severity=evidence.severity)
    for evidence in sorted(result.evidence, key=lambda item: item.severity not in {"high", "medium"}):
        if (evidence.kind == "structure" and evidence.source == "Struktur URL"
                and evidence.validation == "verified" and evidence.code in STRUCTURE_CODES):
            add("url_structure", evidence.code, "observed", severity=evidence.severity)
    return AnalystInput(risk=result.risk, status=result.status, evidence=items)


EvidenceID = Annotated[str, Field(pattern=r"^EV-\d{3}$")]


def unique_fields(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidAnalystResponse("Duplicate provider JSON key")
        result[key] = value
    return result


def decode_output(raw: str):
    if not isinstance(raw, str) or len(raw) > MAX_TEXT_BYTES or len(raw.encode()) > MAX_TEXT_BYTES:
        raise InvalidAnalystResponse("Provider text exceeds byte limit")
    return json.loads(raw, object_pairs_hook=unique_fields)


class Generator(Protocol):
    async def generate(self, *, key: str, model: str, instruction: str, payload: str, schema: dict) -> str: ...


class SecurityAnalyst:
    def __init__(self, settings: Settings, generator: Generator | None = None, *, openrouter: bool = False):
        self.settings = settings
        self.generator = generator if generator is not None else MistralGenerator()
        self.openrouter = openrouter
        self.slots = asyncio.Semaphore(MAX_CONCURRENT)
        self.cooldown_until = 0.0

    def credentials(self) -> tuple[str, str]:
        if self.openrouter:
            key, model = self.settings.openrouter_api_key, self.settings.openrouter_detector_model
        else:
            key, model = self.settings.mistral_api_key, self.settings.mistral_model
        return (key.get_secret_value().strip() if key else "", (model or "").strip())

    def configured(self) -> bool:
        key, model = self.credentials()
        return bool(key and (model if self.openrouter else MODEL_ID.fullmatch(model)))

    async def request(
        self, input_data: AnalystInput, *, consent: bool = False, instruction: str, schema: dict,
    ) -> tuple[ServiceStatus, str | None]:
        if not self.settings.awasin_ai_enabled:
            return "disabled", None
        if consent is not True:
            return "not_requested", None
        if not self.configured():
            return "unavailable", None
        key, model = self.credentials()
        if monotonic() < self.cooldown_until or self.slots.locked():
            return "rate_limited", None
        try:
            # The URL analyst receives observations without the local fallback verdict.
            exclude = {"risk", "status", "openrouter_fallback_consent", "history_report"} if isinstance(input_data, UrlAnalystInput) else None
            payload = input_data.model_dump_json(exclude_none=True, exclude=exclude)
            if len(payload.encode()) > MAX_INPUT_BYTES:
                return "unavailable", None
            async with self.slots, asyncio.timeout(TIMEOUT_SECONDS):
                raw = await self.generator.generate(key=key, model=model, instruction=instruction, payload=payload, schema=schema)
            if not self.settings.awasin_ai_enabled:
                return "disabled", None
            if not isinstance(raw, str):
                return "invalid_response", None
            return "completed", raw
        except MistralHTTPError as error:
            if error.status == 429:
                self.cooldown_until = monotonic() + RATE_LIMIT_COOLDOWN
                return "rate_limited", None
            return "unavailable", None
        except (TimeoutError, httpx.TimeoutException):
            return "timeout", None
        except (InvalidAnalystResponse, ValidationError, json.JSONDecodeError, UnicodeError, RecursionError):
            return "invalid_response", None
        except Exception:
            # Provider errors may contain request or response data. Keep the fallback status only.
            return "unavailable", None
