from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, StringConstraints, model_validator

from app.modules.history.schemas import ScanMode
from .ai_schema import AIOffer, DetectorResult

Status = Literal["completed", "partial", "inconclusive", "unavailable", "failed"]
Risk = Literal["low", "medium", "high", "unknown"]
ErrorCode = Literal["engine_unavailable", "engine_timeout", "engine_failed"]
MediaMode = Literal["message", "qr", "image", "video"]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Explanation = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class AnalysisModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RequestContext(AnalysisModel):
    request_id: UUID = Field(default_factory=uuid4)
    history_consent: StrictBool = False


class UrlRequest(RequestContext):
    mode: Literal["link", "website"]
    url: str = Field(min_length=1, max_length=4096)
    threat_lookup_consent: StrictBool = False
    enhanced_lookup_consent: StrictBool = False
    ai_consent: StrictBool = False
    url_ai_consent: StrictBool = False
    openrouter_fallback_consent: StrictBool = False
    detector_consent: StrictBool = False
    defer_detector: StrictBool = False


class MessageOptions(AnalysisModel):
    message_ai_consent: StrictBool = False
    message_openrouter_consent: StrictBool = False
    message_link_consent: StrictBool = False
    message_link_enhanced_consent: StrictBool = False


class MessageRequest(RequestContext, MessageOptions):
    mode: Literal["message"]
    text: str = Field(min_length=1, max_length=10000)


class QrRequest(RequestContext):
    mode: Literal["qr"]
    payload: str = Field(min_length=1, max_length=4096)


TextRequest = Annotated[UrlRequest | MessageRequest | QrRequest, Field(discriminator="mode")]


class MediaRequest(RequestContext, MessageOptions):
    mode: MediaMode
    text: str | None = Field(default=None, max_length=10000)

    @model_validator(mode="after")
    def allow_message_text_only(self):
        if self.mode != "message" and (self.text is not None or self.message_ai_consent or self.message_link_consent
                                       or self.message_link_enhanced_consent or self.message_openrouter_consent):
            raise ValueError("Text is only accepted for a message screenshot")
        return self


class MediaMetadata(AnalysisModel):
    content_type: Literal["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]
    size_bytes: int = Field(gt=0)
    width: int | None = Field(default=None, gt=0)
    height: int | None = Field(default=None, gt=0)


class Evidence(AnalysisModel):
    id: UUID = Field(default_factory=uuid4)
    code: ShortText
    kind: ShortText
    explanation: Explanation
    indicator: ShortText | None = None
    source: ShortText
    observed_at: AwareDatetime
    severity: Risk = "unknown"
    validation: Literal["verified", "unverified"]
    limitations: list[Explanation] = Field(default_factory=list, max_length=10)


class Provenance(AnalysisModel):
    engine: ShortText
    version: ShortText
    source_type: ShortText
    checked_at: AwareDatetime
    dataset_version: ShortText | None = None


class ProviderCheck(AnalysisModel):
    provider: Literal["VirusTotal", "VirusTotal File", "VirusTotal AI", "urlscan.io", "DNS", "RDAP"]
    status: Literal["found", "not_found", "skipped", "unavailable", "rate_limited", "timeout", "unauthorized", "error"]
    observed_at: AwareDatetime | None = None
    specificity: Literal["exact_url", "hostname", "related_domain", "file_hash"] | None = None
    archive_observed_at: AwareDatetime | None = None
    engine_count: int | None = Field(default=None, ge=0, le=10000)
    verdict: Literal["malicious", "suspicious", "no_detection", "unknown"] | None = None
    freshness: Literal["recent", "stale", "unknown"] | None = None
    counts: dict[Literal["malicious", "suspicious", "harmless", "undetected"], int] = Field(default_factory=dict)
    categories: list[ShortText] = Field(default_factory=list, max_length=8)
    record_id: ShortText | None = None
    details: list[ShortText] = Field(default_factory=list, max_length=12)
    limitations: list[Explanation] = Field(default_factory=list, max_length=8)


class UrlReport(AnalysisModel):
    display_url: str = Field(max_length=290)
    registered_domain: str | None
    scheme_assumed: bool
    components_hidden: bool
    threat_status: Literal["match", "no_match", "unavailable", "not_requested", "unsupported", "timeout", "rate_limited", "invalid_response"]
    threat_checked_at: AwareDatetime | None = None
    threat_provider: Literal["Google Safe Browsing", "Google Web Risk"] = "Google Safe Browsing"
    identity_status: Literal["reference_match", "possible_impersonation", "name_similarity", "insufficient_evidence"]
    recommendations: list[Explanation] = Field(max_length=5)
    supplementary_checks: list[ProviderCheck] = Field(default_factory=list, max_length=6)
    registry_snapshot_used: bool = False


class MessageLink(AnalysisModel):
    host: ShortText
    status: Literal['not_requested', 'ambiguous', 'match', 'no_match', 'unavailable', 'unsupported', 'timeout', 'rate_limited', 'invalid_response']
    risk: Risk = "unknown"


class MessageReport(AnalysisModel):
    ocr_status: Literal['not_requested', 'completed', 'low_confidence', 'truncated', 'empty', 'timeout', 'unavailable', 'missing_languages', 'failed', 'busy']
    ai_status: Literal['not_requested', 'disabled', 'unavailable', 'rate_limited', 'timeout', 'invalid_response', 'completed'] = 'not_requested'
    analyst: Literal['mistral', 'nemotron'] | None = None
    fallback_status: Literal['unavailable', 'rate_limited', 'timeout', 'invalid_response'] | None = None
    links: list[MessageLink] = Field(default_factory=list, max_length=3)
    recommendations: list[Explanation] = Field(default_factory=list, max_length=5)
    ocr_preview: str | None = Field(default=None, max_length=10000)


class EngineResult(AnalysisModel):
    status: Literal["completed", "partial", "inconclusive"]
    risk: Risk = "unknown"
    explanation: Explanation
    evidence: list[Evidence] = Field(default_factory=list, max_length=30)
    provenance: Provenance
    limitations: list[Explanation] = Field(default_factory=list, max_length=20)
    url_report: UrlReport | None = None
    message_report: MessageReport | None = None

    @model_validator(mode="after")
    def require_evidence_for_risk(self):
        if len({item.id for item in self.evidence}) != len(self.evidence):
            raise ValueError("Evidence IDs must be unique")
        if self.risk != "unknown" and (
            self.status != "completed" or not any(item.validation == "verified" for item in self.evidence)
        ):
            raise ValueError("Known risk requires a completed result with verified evidence")
        return self


class AnalysisResponse(AnalysisModel):
    analysis_id: UUID
    request_id: UUID
    mode: ScanMode
    status: Status
    risk: Risk = "unknown"
    checked_at: AwareDatetime
    explanation: Explanation
    evidence: list[Evidence] = Field(default_factory=list, max_length=30)
    provenance: Provenance | None = None
    processing: Literal["real", "not_performed", "unavailable", "failed"]
    limitations: list[Explanation] = Field(default_factory=list, max_length=20)
    error_code: ErrorCode | None = None
    media: MediaMetadata | None = None
    history_eligible: Literal[False] = False
    history_status: Literal['saved', 'disabled', 'unconfigured', 'unavailable'] | None = None
    url_report: UrlReport | None = None
    message_report: MessageReport | None = None
    ai: AIOffer | None = None
    detector: DetectorResult | None = None
    detector_offer: AIOffer | None = None
