from fastapi import APIRouter

from app.modules.health.router import router as health_router
from app.modules.identity.router import router as identity_router

router = APIRouter()
router.include_router(health_router)
router.include_router(identity_router)
