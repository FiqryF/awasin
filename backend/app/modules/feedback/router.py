import asyncio
from collections import OrderedDict, deque
import time
import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from starlette.exceptions import HTTPException

from app.modules.identity.router import bearer, service
from app.modules.identity.service import IdentityService
from app.modules.history.service import HistoryService

router = APIRouter(prefix='/feedback', tags=['Feedback'])
ERROR_TYPES = {'Konten berisiko dinilai aman', 'Konten aman dinilai berisiko', 'Hasil analisis tidak sesuai / lainnya'}
FEATURES = {'Link Inspector', 'Message Analyzer', 'Fake Website Detector', 'QR Code Scanner', 'AI Media Analyzer', 'Login/Register', 'Lainnya'}


class FeedbackFields(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    errorType: str = Field(default='', max_length=120)
    feature: str = Field(default='', max_length=120)
    title: str = Field(default='', max_length=120)
    description: str = Field(min_length=10, max_length=5000)
    reproduction: str = Field(default='', max_length=2000)
    benefit: str = Field(default='', max_length=1000)


class FeedbackInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    submission_key: UUID
    category: Literal['detection', 'bug', 'idea', 'other']
    fields: FeedbackFields
    contact_email: str | None = Field(default=None, max_length=254)
    report_id: UUID | None = None
    consent: Literal[True]

    @field_validator('consent', mode='before')
    @classmethod
    def explicit_consent(cls, value):
        if value is not True:
            raise ValueError('Explicit consent required')
        return value

    @field_validator('contact_email')
    @classmethod
    def valid_email(cls, value):
        if value is None:
            return value
        parts = value.split('@')
        if len(parts) != 2 or not parts[0] or '.' not in parts[1] or parts[1].endswith('.') or any(char.isspace() for char in value):
            raise ValueError('Invalid email')
        return value

    @model_validator(mode='after')
    def category_fields(self):
        if len(json.dumps(self.fields.model_dump(exclude_defaults=True), ensure_ascii=False).encode()) > 20000:
            raise ValueError('Feedback text too large')
        if self.category == 'detection' and self.fields.errorType not in ERROR_TYPES:
            raise ValueError('Invalid detection type')
        if self.category == 'bug' and self.fields.feature not in FEATURES:
            raise ValueError('Invalid feature')
        if self.category == 'idea' and len(self.fields.title) < 5:
            raise ValueError('Idea title too short')
        if self.report_id and self.category != 'detection':
            raise ValueError('Report reference requires detection category')
        allowed = {'detection': {'errorType', 'description'}, 'bug': {'feature', 'description', 'reproduction'}, 'idea': {'title', 'description', 'benefit'}, 'other': {'title', 'description'}}[self.category]
        if any(value for key, value in self.fields.model_dump().items() if key not in allowed):
            raise ValueError('Unexpected category fields')
        return self


class FeedbackReceipt(BaseModel):
    receipt_id: UUID


class FeedbackExport(BaseModel):
    id: UUID
    category: Literal['detection','bug','idea','other']
    fields: dict[str, str]
    contact_email: str | None
    report_id: UUID | None
    created_at: datetime


class FeedbackLimiter:
    """Per-worker IP throttle; database RPC separately limits direct callers.

    Configure trusted reverse proxies at deployment. IPs are never persisted.
    """
    def __init__(self):
        self.buckets = OrderedDict()
        self.lock = asyncio.Lock()

    async def check(self, key: str):
        async with self.lock:
            now = time.monotonic()
            bucket = self.buckets.pop(key, deque())
            while bucket and bucket[0] <= now - 600:
                bucket.popleft()
            self.buckets[key] = bucket
            if len(bucket) >= 5:
                raise HTTPException(429, headers={'Retry-After': '600'})
            bucket.append(now)
            while len(self.buckets) > 5000:
                self.buckets.popitem(last=False)


@router.post('', response_model=FeedbackReceipt)
async def submit_feedback(payload: FeedbackInput, response: Response, request: Request,
                          provider: Annotated[IdentityService, Depends(service)],
                          credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    await request.app.state.feedback_limiter.check(request.client.host if request.client else 'unknown')
    if request.headers.get('authorization') and not credentials:
        raise HTTPException(401)
    token = credentials.credentials if credentials else None
    # Invalid presented authentication must never silently become guest feedback.
    identity = await provider.resolve(token) if token else None
    if payload.report_id:
        if not identity:
            raise HTTPException(403)
        await HistoryService(provider, token, identity).get(payload.report_id)
    result = await provider.request('POST', '/rest/v1/rpc/submit_feedback', token, json={
        'p_submission_key': str(payload.submission_key), 'p_category': payload.category,
        'p_fields': payload.fields.model_dump(exclude_defaults=True), 'p_contact_email': payload.contact_email,
        'p_report_id': str(payload.report_id) if payload.report_id else None, 'p_consent': payload.consent,
    })
    try:
        receipt = FeedbackReceipt(receipt_id=result.json())
    except (ValueError, TypeError):
        raise HTTPException(503) from None
    response.headers['Cache-Control'] = 'no-store'
    return receipt
