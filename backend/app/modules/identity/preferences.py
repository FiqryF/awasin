from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError
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


class AccountDeletion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    password: Annotated[SecretStr, Field(min_length=1, max_length=128)]
    confirmation: Literal['HAPUS']


@router.delete('/me')
async def delete_account(payload: AccountDeletion, response: Response, identity: User, provider: Provider):
    settings = provider.settings
    secret = settings.supabase_history_secret_key
    key = secret.get_secret_value().strip() if secret else ''
    origin = settings.supabase_url
    if not origin or not settings.supabase_publishable_key or not key.startswith('sb_secret_'):
        raise HTTPException(503)

    owner = str(identity.id)
    try:
        verification = await provider.client.post(f'{origin}/auth/v1/token', params={'grant_type': 'password'},
            headers={'apikey': settings.supabase_publishable_key.get_secret_value()},
            json={'email': identity.email, 'password': payload.password.get_secret_value()}, timeout=5)
    except httpx.HTTPError:
        raise HTTPException(503) from None
    if verification.status_code == 429:
        raise HTTPException(429)
    if verification.status_code in (400, 401, 403):
        raise HTTPException(403)
    if not verification.is_success:
        raise HTTPException(503)
    try:
        verified = verification.json()
        token = verified['access_token']
        user = verified['user']
        if not isinstance(token, str) or not token or user['id'] != owner:
            raise ValueError()
        require_mfa = any(factor['status'] == 'verified' for factor in user.get('factors') or [])
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(403) from None
    try:
        # Revoke only the short-lived session created by the password check.
        await provider.request('POST', '/auth/v1/logout', token, params={'scope': 'local'})
    except HTTPException:
        raise HTTPException(503) from None
    if require_mfa and identity.aal != 'aal2':
        raise HTTPException(403)

    try:
        headers = {'apikey': key}
        avatar = await provider.client.request('DELETE', f'{origin}/storage/v1/object/account-avatars',
            headers=headers, json={'prefixes': [f'{owner}/avatar.jpg']}, timeout=5)
        if not avatar.is_success:
            raise HTTPException(503)
        account = await provider.client.request('DELETE', f'{origin}/auth/v1/admin/users/{owner}',
            headers=headers, json={'should_soft_delete': False}, timeout=5)
    except httpx.HTTPError:
        raise HTTPException(503) from None
    if not account.is_success:
        raise HTTPException(503)
    response.headers['Cache-Control'] = 'no-store'
    return {'deleted': True}


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
