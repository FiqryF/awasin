from importlib.metadata import version

from fastapi import APIRouter

from app.modules.health.schemas import HealthResponse

APP_VERSION = version("awasin-backend")
router = APIRouter(tags=["Health"])


@router.get("/health", summary="Application process health")
def health() -> HealthResponse:
    """Confirm this API process responds; does not probe Supabase or providers."""
    return HealthResponse(version=APP_VERSION)
