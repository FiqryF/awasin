import asyncio
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import BinaryIO, Protocol
from uuid import UUID, uuid4

from anyio import CapacityLimiter

from app.modules.history.schemas import ScanMode

from .schemas import AnalysisResponse, EngineResult, ErrorCode, MediaMetadata


@dataclass(frozen=True, slots=True, repr=False)
class AnalysisInput:
    mode: ScanMode
    request_id: UUID
    owner_id: str | None
    history_consent: bool
    text: str | None = None
    url: str | None = None
    qr_payload: str | None = None
    media: MediaMetadata | None = None
    media_stream: BinaryIO | None = None


class EngineAdapter(Protocol):
    async def analyze(self, request: AnalysisInput) -> EngineResult:
        """Return display-safe evidence only. Respect cancellation and do not retain input."""
        ...


class AnalysisOrchestrator:
    def __init__(
        self,
        adapters: Mapping[ScanMode, EngineAdapter] | None = None,
        *,
        timeout: float = 5,
        max_concurrent: int = 4,
    ):
        self.adapters = dict(adapters or {})
        self.timeout = timeout
        self.capacity = CapacityLimiter(max_concurrent)

    async def run(self, request: AnalysisInput) -> AnalysisResponse:
        base = {
            "analysis_id": uuid4(),
            "request_id": request.request_id,
            "mode": request.mode,
            "media": request.media,
        }
        adapter = self.adapters.get(request.mode)
        if adapter is None:
            return AnalysisResponse(
                **base, checked_at=datetime.now(UTC), status="unavailable", processing="unavailable",
                explanation="Analisis untuk jenis konten ini belum tersedia.",
                limitations=["Validasi input tidak menghasilkan penilaian risiko."],
                error_code="engine_unavailable",
            )
        error: ErrorCode
        try:
            async with asyncio.timeout(self.timeout):
                result = await adapter.analyze(request)
                if not isinstance(result, EngineResult):
                    raise TypeError("Adapter returned an invalid result")
        except TimeoutError:
            error, message = "engine_timeout", "Analisis melewati batas waktu. Coba lagi."
        except Exception:
            error, message = "engine_failed", "Analisis belum dapat diselesaikan. Coba lagi."
        else:
            return AnalysisResponse(
                **base, **result.model_dump(), checked_at=datetime.now(UTC), processing="real",
            )
        return AnalysisResponse(
            **base, checked_at=datetime.now(UTC), status="failed", processing="failed",
            explanation=message, error_code=error,
        )
