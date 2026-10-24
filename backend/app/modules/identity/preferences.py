from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, ValidationError
from starlette.exceptions import HTTPException

from app.modules.history.schemas import ReportDetail
from app.modules.history.service import DETAIL, HistoryService
from app.modules.feedback.router import FeedbackExport
from .router import access_token, current_user, service
from .service import Identity, IdentityService

router = APIRouter(prefix='/account', tags=['Account settings'])


class Preferences(BaseModel):
    model_config = ConfigDict(extra='forbid')
    history_retention: Literal['manual', 'disabled']
    animation: Literal['system', 'reduced']


async def read_preferences(provider: IdentityService, token: str, identity: Identity) -> Preferences:
    response = await provider.request('GET', '/rest/v1/profiles', token, params={
        'id': f'eq.{identity.id}', 'select': 'id,history_retention,animation', 'limit': '1',
    })
    try:
        rows = response.json()
        if not isinstance(rows, list) or len(rows) != 1 or rows[0].get('id') != str(identity.id):
            raise ValueError()
        return Preferences.model_validate({key: rows[0][key] for key in Preferences.model_fields})
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(503) from None


Token = Annotated[str, Depends(access_token)]
User = Annotated[Identity, Depends(current_user)]
Provider = Annotated[IdentityService, Depends(service)]


@router.get('/preferences', response_model=Preferences)
async def preferences(response: Response, token: Token, identity: User, provider: Provider):
    response.headers['Cache-Control'] = 'no-store'
    return await read_preferences(provider, token, identity)


@router.patch('/preferences', response_model=Preferences)
async def update_preferences(payload: Preferences, response: Response, token: Token, identity: User, provider: Provider):
    await provider.request('PATCH', '/rest/v1/profiles', token, params={'id': f'eq.{identity.id}'}, json=payload.model_dump())
    response.headers['Cache-Control'] = 'no-store'
    return await read_preferences(provider, token, identity)


@router.get('/export')
async def export_account(response: Response, token: Token, identity: User, provider: Provider):
    preferences = await read_preferences(provider, token, identity)
    history = HistoryService(provider, token, identity)
    records = await provider.request('GET', '/rest/v1/scan_reports', token, prefer='count=exact', params={
        'owner_id': f'eq.{identity.id}', 'saved_at': 'not.is.null', 'select': DETAIL,
        'order': 'created_at.asc,id.asc', 'limit': '501',
    })
    rows = history.owned_rows(records)
    total = records.headers.get('content-range', '').rsplit('/', 1)[-1]
    if not total.isdecimal():
        raise HTTPException(503)
    if int(total) > 500:
        raise HTTPException(413)
    if len(rows) != int(total):
        raise HTTPException(503)
    feedback_response = await provider.request('GET', '/rest/v1/feedback_submissions', token, prefer='count=exact', params={
        'owner_id': f'eq.{identity.id}', 'select': 'id,owner_id,category,fields,contact_email,report_id,created_at',
        'order': 'created_at.asc,id.asc', 'limit': '501',
    })
    feedback_rows = history.owned_rows(feedback_response)
    feedback_total = feedback_response.headers.get('content-range', '').rsplit('/', 1)[-1]
    if not feedback_total.isdecimal():
        raise HTTPException(503)
    if int(feedback_total) > 500:
        raise HTTPException(413)
    if len(feedback_rows) != int(feedback_total):
        raise HTTPException(503)
    try:
        reports = [ReportDetail.model_validate(row).model_dump(mode='json') for row in rows]
        feedback = [FeedbackExport.model_validate(row).model_dump(mode='json') for row in feedback_rows]
    except ValidationError:
        raise HTTPException(503) from None
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Content-Disposition'] = 'attachment; filename="awasin-data.json"'
    return {'format_version': 2, 'scope': 'Profile, preferences, all saved reports and own account-linked feedback (maximum 500 of each). No credentials, raw uploads or unsaved reports.',
            'profile': {'id': str(identity.id), 'display_name': identity.profile.display_name, 'email': identity.email},
            'preferences': preferences.model_dump(), 'saved_reports': reports, 'feedback': feedback}
