from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from starlette.exceptions import HTTPException

from app.modules.identity.router import access_token, current_user, service
from app.modules.identity.service import Identity, IdentityService
from .schemas import DeleteResult, HistoryPage, ReportDetail, SaveReport, ScanMode
from .service import HistoryService

router = APIRouter(prefix='/history', tags=['Scan history'])


def history_service(token: Annotated[str, Depends(access_token)], identity: Annotated[Identity, Depends(current_user)], provider: Annotated[IdentityService, Depends(service)]) -> HistoryService:
    return HistoryService(provider, token, identity)


History = Annotated[HistoryService, Depends(history_service)]


@router.get('', response_model=HistoryPage)
async def list_history(response: Response, history: History, mode: ScanMode | None = None, search: Annotated[str, Query(max_length=80, pattern=r'^[\w .-]*$')] = '', sort: Literal['newest', 'oldest'] = 'newest', cursor: Annotated[str | None, Query(max_length=300)] = None, limit: Annotated[int, Query(ge=1, le=50)] = 20):
    response.headers['Cache-Control'] = 'no-store'
    return await history.list(mode, search.strip(), sort, cursor, limit)


@router.post('', response_model=ReportDetail)
async def save_report(payload: SaveReport, response: Response, history: History):
    response.headers['Cache-Control'] = 'no-store'
    return await history.save(payload.report_id)


@router.delete('', response_model=DeleteResult)
async def clear_history(response: Response, history: History, confirm: bool = False):
    # A separate explicit confirmation is required for the all-record operation.
    if confirm is not True:
        raise HTTPException(422)
    response.headers['Cache-Control'] = 'no-store'
    return DeleteResult(deleted=await history.delete())


@router.get('/{report_id}', response_model=ReportDetail)
async def report_detail(report_id: UUID, response: Response, history: History, preview: bool = False):
    response.headers['Cache-Control'] = 'no-store'
    return await history.get(report_id, saved_only=not preview)


@router.delete('/{report_id}', response_model=DeleteResult)
async def delete_report(report_id: UUID, response: Response, history: History):
    response.headers['Cache-Control'] = 'no-store'
    return DeleteResult(deleted=await history.delete(report_id))
