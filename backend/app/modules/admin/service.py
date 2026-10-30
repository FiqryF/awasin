"""Admin requests keep the caller JWT; PostgreSQL independently enforces role/session."""
import httpx
from starlette.exceptions import HTTPException
from app.modules.identity.service import IdentityService


class AdminService:
    def __init__(self, provider: IdentityService, token: str):
        self.provider, self.token = provider, token

    async def rpc(self, name: str, payload: dict):
        provider = self.provider
        if not provider.settings.supabase_url or not provider.settings.supabase_publishable_key:
            raise HTTPException(503)
        try:
            response = await provider.client.post(f'{provider.settings.supabase_url}/rest/v1/rpc/{name}',
                headers={'apikey': provider.settings.supabase_publishable_key.get_secret_value(), 'Authorization': f'Bearer {self.token}'}, json=payload)
        except httpx.HTTPError:
            raise HTTPException(503) from None
        if response.status_code == 429:
            raise HTTPException(429)
        if response.status_code in (401, 403):
            raise HTTPException(response.status_code)
        if not response.is_success:
            try:
                code = response.json().get('code')
            except (ValueError, AttributeError):
                code = None
            if code in ('23505', '40001'):
                raise HTTPException(409, 'Data sudah ada atau berubah. Muat ulang sebelum menyimpan.')
            if code in ('23503', '23514', '22023', '22P02'):
                raise HTTPException(422, 'Data atau transisi status tidak valid.')
            raise HTTPException(503)
        if len(response.content) > 1_000_000:
            raise HTTPException(503)
        try:
            return response.json()
        except ValueError:
            raise HTTPException(503) from None

    async def mutate(self, kind, record_id, payload):
        data = payload.model_dump(mode='json')
        version = data.pop('version', None)
        return await self.rpc('admin_mutate', {'p_kind': kind, 'p_id': str(record_id) if record_id else None, 'p_data': data, 'p_version': version})

    async def page(self, table: str, offset: int, limit: int, filters: dict, select: str = '*'):
        response = await self.provider.request('GET', f'/rest/v1/{table}', self.token, prefer='count=exact', params={
            'select': select, 'order': 'created_at.desc,id.desc', 'offset': str(offset), 'limit': str(limit), **filters})
        try:
            rows = response.json()
            count = response.headers['content-range'].rsplit('/', 1)[-1]
            if not isinstance(rows, list) or not count.isdecimal():
                raise ValueError()
            return {'items': rows, 'total': int(count)}
        except (ValueError, KeyError):
            raise HTTPException(503) from None

    async def one(self, table: str, record_id, select='*', key='id'):
        response = await self.provider.request('GET', f'/rest/v1/{table}', self.token, params={key: f'eq.{record_id}', 'select': select, 'limit': '1'})
        rows = response.json()
        if not isinstance(rows, list):
            raise HTTPException(503)
        if not rows:
            raise HTTPException(404)
        return rows[0]
