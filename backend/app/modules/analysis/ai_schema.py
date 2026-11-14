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
    fallback_status: Literal["unavailable", "rate_limited", "timeout", "validation_failed"] | None = None
    history_status: Literal['saved', 'disabled', 'unconfigured', 'unavailable'] | None = None


class AIUrlAnalysis(AIExplanation):
    risk: Literal["low", "medium", "high", "unknown"]
    needs_verification: bool = False
    analyst: Literal["mistral", "nemotron"] = "mistral"


DetectorCategory = Literal["brand_mismatch", "lookalike_domain", "subdomain_deception", "obfuscated_url", "redirect_hint", "credential_lure"]
DetectorVerdict = Literal["likely_legitimate", "suspicious", "malicious", "unknown"]
DETECTOR_SUMMARIES = {
    "likely_legitimate": "Tautan ini kemungkinan sah: domain cocok dengan referensi AWASIN dan tidak ditemukan dalam daftar ancaman yang diperiksa. Ini belum menjamin keamanan isi website.",
    "suspicious": "Tautan ini dinilai mencurigakan oleh AI berdasarkan bukti yang tersedia. Verifikasi tujuannya sebelum memasukkan data pribadi; temuan ini belum membuktikan penipuan.",
    "malicious": "Tautan ini memiliki indikasi berbahaya yang didukung kecocokan pada daftar ancaman. Sebaiknya jangan lanjutkan dan gunakan kanal resmi secara terpisah.",
    "unknown": "AI belum memiliki cukup bukti untuk memastikan apakah tautan ini sah atau merupakan penipuan.",
}


class DetectorFinding(AIModel):
    category: DetectorCategory
    assessment: Literal["observed", "suspected"]
    description: str
    feature_ids: list[str]


class DetectorResult(AIModel):
    status: Literal["completed", "disabled", "unavailable", "rate_limited", "timeout", "validation_failed"]
    findings: list[DetectorFinding] = Field(default_factory=list)
    verdict: DetectorVerdict | None = None
    summary: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
