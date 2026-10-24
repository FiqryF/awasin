from fastapi import APIRouter
from app.modules.identity.preferences import router as account_router
from app.modules.feedback.router import router as feedback_router

from app.modules.health.router import router as health_router
from app.modules.identity.router import router as identity_router
from app.modules.history.router import router as history_router

router = APIRouter()
router.include_router(account_router)
router.include_router(feedback_router)
router.include_router(health_router)
router.include_router(identity_router)
router.include_router(history_router)
