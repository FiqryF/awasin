from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response
from pydantic import Field
from starlette.exceptions import HTTPException
from app.modules.identity.router import access_token, administrator, service
from app.modules.identity.service import Identity, IdentityService
from .schemas import Organization, DomainInput, DomainUpdate, DomainReview, FeedbackReview, ArticleInput, ArticleUpdate, ArticlePublish
from .service import AdminService

router = APIRouter(prefix='/admin', tags=['Administrator'], dependencies=[Depends(administrator)])
Search = Annotated[str, Query(max_length=80, pattern=r'^[\w .-]*$')]
Offset = Annotated[int, Query(ge=0, le=100000)]
Limit = Annotated[int, Query(ge=1, le=50)]


def admin_service(response: Response, token: Annotated[str, Depends(access_token)], provider: Annotated[IdentityService, Depends(service)], identity: Annotated[Identity, Depends(administrator)]):
    response.headers['Cache-Control'] = 'no-store'
    return AdminService(provider, token)


Admin = Annotated[AdminService, Depends(admin_service)]


@router.get('/overview')
async def overview(admin: Admin):
    return await admin.rpc('admin_overview', {})


@router.get('/feedback')
async def feedback(admin: Admin, offset: Offset = 0, limit: Limit = 20, category: Literal['', 'detection', 'bug', 'idea', 'other'] = '', status: Literal['', 'new', 'in_review', 'resolved'] = '', search: Search = '', since: datetime | None = None):
    return await admin.rpc('admin_feedback_page', {'p_offset': offset, 'p_limit': limit, 'p_category': category, 'p_status': status, 'p_search': search, 'p_since': since.isoformat() if since else None})


@router.get('/feedback/{record_id}')
async def feedback_detail(record_id: UUID, admin: Admin):
    original = await admin.one('feedback_submissions', record_id, 'id,category,fields,contact_email,report_id,created_at')
    response = await admin.provider.request('GET', '/rest/v1/feedback_handling', admin.token, params={'feedback_id': f'eq.{record_id}', 'select': 'status,note,version,updated_at', 'limit': '1'})
    rows = response.json()
    return {**original, **(rows[0] if rows else {'status': 'new', 'note': '', 'version': 1})}


@router.patch('/feedback/{record_id}')
async def review_feedback(record_id: UUID, payload: FeedbackReview, admin: Admin):
    return await admin.mutate('feedback', record_id, payload)


@router.get('/organizations')
async def organizations(admin: Admin, offset: Offset = 0, limit: Limit = 20, search: Search = ''):
    return await admin.page('registry_organizations', offset, limit, {'name': f'ilike.*{search}*'} if search else {})


@router.post('/organizations', status_code=201)
async def create_organization(payload: Organization, admin: Admin):
    return await admin.mutate('organization', None, payload)


class OrganizationUpdate(Organization):
    version: int = Field(ge=1)


@router.patch('/organizations/{record_id}')
async def update_organization(record_id: UUID, payload: OrganizationUpdate, admin: Admin):
    return await admin.mutate('organization', record_id, payload)


@router.get('/domains')
async def domains(admin: Admin, offset: Offset = 0, limit: Limit = 20, search: Search = '', status: Literal['', 'pending_review', 'verified', 'rejected', 'archived'] = ''):
    filters = {'domain': f'ilike.*{search}*'} if search else {}
    if status:
        filters['status'] = f'eq.{status}'
    return await admin.page('registry_domains', offset, limit, filters)


@router.post('/domains', status_code=201)
async def create_domain(payload: DomainInput, admin: Admin):
    return await admin.mutate('domain', None, payload)


@router.patch('/domains/{record_id}')
async def update_domain(record_id: UUID, payload: DomainUpdate, admin: Admin):
    return await admin.mutate('domain', record_id, payload)


@router.post('/domains/{record_id}/review')
async def review_domain(record_id: UUID, payload: DomainReview, admin: Admin):
    return await admin.mutate('domain_review', record_id, payload)


@router.get('/articles')
async def articles(admin: Admin, offset: Offset = 0, limit: Limit = 20, search: Search = '', status: Literal['', 'draft', 'published', 'archived'] = ''):
    filters = {'title': f'ilike.*{search}*'} if search else {}
    if status:
        filters['status'] = f'eq.{status}'
    return await admin.page('education_articles', offset, limit, filters, 'id,slug,title,category,status,version,created_at,updated_at')


@router.get('/articles/{record_id}')
async def article_detail(record_id: UUID, admin: Admin):
    return await admin.one('education_articles', record_id)


@router.post('/articles', status_code=201)
async def create_article(payload: ArticleInput, admin: Admin):
    return await admin.mutate('article', None, payload)


@router.patch('/articles/{record_id}')
async def update_article(record_id: UUID, payload: ArticleUpdate, admin: Admin):
    return await admin.mutate('article', record_id, payload)


@router.post('/articles/{record_id}/status')
async def publish_article(record_id: UUID, payload: ArticlePublish, admin: Admin):
    return await admin.mutate('article_status', record_id, payload)


@router.get('/audit')
async def audit(admin: Admin, offset: Offset = 0, limit: Limit = 20, entity_type: Literal['', 'feedback_handling', 'registry_domains', 'registry_organizations', 'education_articles'] = '', entity_id: UUID | None = None, since: datetime | None = None):
    filters = {}
    if entity_type:
        filters['entity_type'] = f'eq.{entity_type}'
    if entity_id:
        filters['entity_id'] = f'eq.{entity_id}'
    if since:
        filters['created_at'] = f'gte.{since.isoformat()}'
    return await admin.page('admin_audit_events', offset, limit, filters)


public_router = APIRouter(prefix='/education', tags=['Public education'])


@public_router.get('')
async def published_articles(response: Response, provider: Annotated[IdentityService, Depends(service)], offset: Offset = 0, limit: Limit = 50):
    response.headers['Cache-Control'] = 'no-store'
    # Deliberately anon even when the browser is signed in: no draft disclosure.
    records = await provider.request('GET', '/rest/v1/education_articles', params={'status': 'eq.published', 'select': 'content', 'order': 'created_at.asc,id.asc', 'offset': str(offset), 'limit': str(limit)})
    return {'items': [ArticleInput.model_validate({'content': row['content']}).content.model_dump() for row in records.json()]}


@public_router.get('/{slug}')
async def published_article(slug: str, response: Response, provider: Annotated[IdentityService, Depends(service)]):
    import re
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or len(slug)>100:
        raise HTTPException(404)
    response.headers['Cache-Control'] = 'no-store'
    records = await provider.request('GET','/rest/v1/education_articles',params={'status':'eq.published','slug':f'eq.{slug}','select':'content','limit':'1'})
    rows=records.json()
    if not rows:
        raise HTTPException(404)
    return ArticleInput.model_validate({'content':rows[0]['content']}).content.model_dump()
