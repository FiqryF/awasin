import base64
from datetime import datetime, timezone
import json
from uuid import UUID

import httpx

from pydantic import ValidationError
from starlette.exceptions import HTTPException

from app.modules.identity.service import Identity, IdentityService
from .schemas import HistoryPage, HistorySummary, ReportDetail

SUMMARY = 'id,owner_id,mode,created_at,saved_at,safe_label,status,risk:result->>risk'
DETAIL = SUMMARY + ',engine,engine_version,analyzed_at,result'


def decode_cursor(value: str) -> tuple[str, str]:
    try:
        if len(value) > 300:
            raise ValueError()
        raw = json.loads(base64.b64decode(value, altchars=b'-_', validate=True))
        if not isinstance(raw, list) or len(raw) != 2 or not all(isinstance(item, str) for item in raw):
            raise ValueError()
        date = datetime.fromisoformat(raw[0])
        if date.tzinfo is None:
            raise ValueError()
        return date.astimezone(timezone.utc).isoformat(), str(UUID(raw[1]))
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(422) from None


class HistoryService:
    def __init__(self, provider: IdentityService, token: str, identity: Identity):
        self.provider, self.token, self.identity = provider, token, identity

    def owned_rows(self, response) -> list[dict]:
        try:
            rows = response.json()
            if not isinstance(rows, list) or any(not isinstance(row, dict) or row.get('owner_id') != str(self.identity.id) for row in rows):
                raise ValueError()
            return rows
        except (ValueError, TypeError):
            raise HTTPException(503) from None

    async def list(self, mode, search: str, sort: str, cursor: str | None, limit: int) -> HistoryPage:
        direction = 'desc' if sort == 'newest' else 'asc'
        params = {'owner_id': f'eq.{self.identity.id}', 'saved_at': 'not.is.null', 'select': SUMMARY, 'order': f'created_at.{direction},id.{direction}', 'limit': str(limit + 1)}
        if mode:
            params['mode'] = f'eq.{mode}'
        if search:
            params['safe_label'] = f'ilike.*{search}*'
        if cursor:
            date, record_id = decode_cursor(cursor)
            operator = 'lt' if sort == 'newest' else 'gt'
            params['or'] = f'(created_at.{operator}.{date},and(created_at.eq.{date},id.{operator}.{record_id}))'
        rows = self.owned_rows(await self.provider.request('GET', '/rest/v1/scan_reports', self.token, params=params))
        try:
            items = [HistorySummary.model_validate(row) for row in rows[:limit]]
            next_cursor = None
            if len(rows) > limit and items:
                item = items[-1]
                next_cursor = base64.urlsafe_b64encode(json.dumps([item.created_at.isoformat(), str(item.id)]).encode()).decode()
            return HistoryPage(items=items, next_cursor=next_cursor)
        except (ValidationError, ValueError, TypeError):
            raise HTTPException(503) from None

    async def get(self, report_id: UUID, saved_only: bool = True) -> ReportDetail:
        params = {'owner_id': f'eq.{self.identity.id}', 'id': f'eq.{report_id}', 'select': DETAIL, 'limit': '1'}
        if saved_only:
            params['saved_at'] = 'not.is.null'
        rows = self.owned_rows(await self.provider.request('GET', '/rest/v1/scan_reports', self.token, params=params))
        if not rows:
            raise HTTPException(404)
        try:
            return ReportDetail.model_validate(rows[0])
        except ValidationError:
            raise HTTPException(503) from None

    async def save(self, report_id: UUID) -> ReportDetail:
        report = await self.get(report_id, saved_only=False)
        if report.status != 'completed':
            raise HTTPException(409)
        response = await self.provider.request('POST', '/rest/v1/rpc/save_scan_report', self.token, json={'p_report_id': str(report_id), 'p_consent': True})
        rows = self.owned_rows(response)
        if not rows:
            raise HTTPException(409)
        return await self.get(report_id)

    async def delete(self, report_id: UUID | None = None) -> int:
        if report_id is None:
            response = await self.provider.request('POST', '/rest/v1/rpc/clear_scan_history', self.token, json={'p_confirm': True})
            try:
                count = response.json()
            except ValueError:
                raise HTTPException(503) from None
            if type(count) is not int or count < 0:
                raise HTTPException(503)
            return count
        params = {'owner_id': f'eq.{self.identity.id}', 'saved_at': 'not.is.null', 'select': 'id,owner_id'}
        if report_id:
            params['id'] = f'eq.{report_id}'
        # Count the actual deleted rows, not a client-side guess or cached total.
        try:
            response = await self.provider.client.request('DELETE', f'{self.provider.settings.supabase_url}/rest/v1/scan_reports', params=params, headers={
                'apikey': self.provider.settings.supabase_publishable_key.get_secret_value(), 'Authorization': f'Bearer {self.token}', 'Prefer': 'return=representation',
            })
        except httpx.HTTPError:
            raise HTTPException(503) from None
        if not response.is_success or len(response.content) > 1_000_000:
            raise HTTPException(503)
        count = len(self.owned_rows(response))
        if report_id and not count:
            raise HTTPException(404)
        return count
