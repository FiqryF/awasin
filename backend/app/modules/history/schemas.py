from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ScanMode = Literal['link', 'message', 'website', 'qr', 'image', 'video']
AnalysisStatus = Literal['pending', 'processing', 'completed', 'failed', 'unsupported']
Risk = Literal['low', 'medium', 'high', 'inconclusive']


class Finding(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)


class Source(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=160)
    reference: str | None = Field(default=None, max_length=500)


class Check(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=160)
    status: Literal['completed', 'failed', 'not_performed', 'unsupported']
    detail: str | None = Field(default=None, max_length=1000)


class AnalysisResult(BaseModel):
    model_config = ConfigDict(extra='forbid')
    risk: Risk | None = None
    findings: list[Finding] = Field(default_factory=list, max_length=30)
    sources: list[Source] = Field(default_factory=list, max_length=20)
    checks: list[Check] = Field(default_factory=list, max_length=30)
    recommendations: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def bounded_recommendations(self):
        if any(not item.strip() or len(item) > 1000 for item in self.recommendations):
            raise ValueError('Invalid recommendation')
        return self


class HistorySummary(BaseModel):
    id: UUID
    mode: ScanMode
    created_at: datetime
    saved_at: datetime | None
    safe_label: str = Field(min_length=1, max_length=160)
    status: AnalysisStatus
    risk: Risk | None = None


class HistoryPage(BaseModel):
    items: list[HistorySummary]
    next_cursor: str | None = None


class ReportDetail(HistorySummary):
    engine: str | None = Field(default=None, max_length=120)
    engine_version: str | None = Field(default=None, max_length=80)
    analyzed_at: datetime | None = None
    result: AnalysisResult

    @model_validator(mode='after')
    def verified_completion(self):
        if self.status == 'completed' and (not self.engine or not self.engine_version or not self.analyzed_at):
            raise ValueError('Completed reports require engine provenance')
        if self.risk != self.result.risk:
            raise ValueError('Inconsistent risk')
        if self.status != 'completed' and self.risk is not None:
            raise ValueError('Incomplete analyses cannot carry an assessment')
        return self


class SaveReport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    report_id: UUID
    consent: Literal[True]


class DeleteResult(BaseModel):
    deleted: int = Field(ge=0)
