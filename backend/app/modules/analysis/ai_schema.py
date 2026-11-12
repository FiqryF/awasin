from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool


class AIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)


class AIOffer(AIModel):
    status: Literal["pending", "disabled", "unavailable", "rate_limited"]
    ticket: str | None = None


class AIRequest(AIModel):
    ticket: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    consent: StrictBool = False


class AIFinding(AIModel):
    evidence_ids: list[str]
    source: str
    explanation: str


class AIExplanation(AIModel):
    status: Literal["completed", "not_requested", "disabled", "unavailable", "rate_limited", "timeout", "validation_failed"]
    summary: str | None = None
    findings: list[AIFinding] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


DetectorCategory = Literal["brand_mismatch", "lookalike_domain", "subdomain_deception", "obfuscated_url", "redirect_hint", "credential_lure"]


class DetectorFinding(AIModel):
    category: DetectorCategory
    assessment: Literal["observed", "suspected"]
    description: str
    feature_ids: list[str]


class DetectorResult(AIModel):
    status: Literal["completed", "disabled", "unavailable", "rate_limited", "timeout", "validation_failed"]
    findings: list[DetectorFinding] = Field(default_factory=list)
