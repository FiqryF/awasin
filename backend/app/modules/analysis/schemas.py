from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, StringConstraints, model_validator

from app.modules.history.schemas import ScanMode

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


class MessageRequest(RequestContext):
    mode: Literal["message"]
    text: str = Field(min_length=1, max_length=10000)


class QrRequest(RequestContext):
    mode: Literal["qr"]
    payload: str = Field(min_length=1, max_length=4096)


TextRequest = Annotated[UrlRequest | MessageRequest | QrRequest, Field(discriminator="mode")]


class MediaRequest(RequestContext):
    mode: MediaMode
    text: str | None = Field(default=None, max_length=10000)

    @model_validator(mode="after")
    def allow_message_text_only(self):
        if self.text is not None and self.mode != "message":
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


class EngineResult(AnalysisModel):
    status: Literal["completed", "partial", "inconclusive"]
    risk: Risk = "unknown"
    explanation: Explanation
    evidence: list[Evidence] = Field(default_factory=list, max_length=30)
    provenance: Provenance
    limitations: list[Explanation] = Field(default_factory=list, max_length=20)

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
