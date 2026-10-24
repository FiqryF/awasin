"""API transport fixtures only. Real RLS runs separately in check:history-db.

JWT verification is covered by test_identity; this suite supplies its verified
identity dependency and checks history's ownership and provider contracts.
"""
import copy
import json
from typing import Annotated
from uuid import UUID, uuid4

import httpx
from fastapi import Depends, HTTPException
from fastapi.testclient import TestClient
from pydantic import SecretStr
import pytest

from app.main import create_app
from app.modules.history.service import decode_cursor
from app.modules.identity.router import access_token, current_user
from app.modules.identity.service import Identity, IdentityService


@pytest.fixture
def history_api(settings):
    owner, other = str(uuid4()), str(uuid4())

    def report(user, saved=True, status='completed'):
        return {'id': str(uuid4()), 'owner_id': user, 'mode': 'link',
                'created_at': '2026-10-23T10:00:00+00:00',
                'saved_at': '2026-10-23T10:01:00+00:00' if saved else None,
                'safe_label': 'Fixture pemeriksaan', 'status': status,
                'risk': None, 'engine': 'test-only-fixture' if status == 'completed' else None,
                'engine_version': '1' if status == 'completed' else None,
                'analyzed_at': '2026-10-23T10:00:01+00:00' if status == 'completed' else None,
                'result': {'risk': None, 'findings': [], 'sources': [], 'checks': [], 'recommendations': []}}

    records = [report(owner), report(other), report(owner, False), report(owner, False, 'unsupported')]
    state = {'rows': records, 'requests': [], 'failure': False, 'wrong_owner': False, 'malformed_clear': False, 'preferences': {'history_retention': 'manual', 'animation': 'system'}, 'feedback': []}
    configured = settings.model_copy(update={'supabase_url': 'https://fixture.supabase.co', 'supabase_publishable_key': SecretStr('fixture-public-key')})

    def respond(request):
        state['requests'].append(request)
        assert request.url.host == 'fixture.supabase.co'
        assert request.headers.get('authorization') in (None, 'Bearer fixture-token')
        if state['failure']:
            return httpx.Response(500, text='private-database-error')
        if request.url.path == '/rest/v1/rpc/submit_feedback':
            payload = json.loads(request.content)
            assert 'owner_id' not in payload
            if state.get('feedback_status'):
                return httpx.Response(state['feedback_status'])
            user = owner if request.headers.get('authorization') else None
            existing = [row for row in state['feedback'] if row['submission_key'] == payload['p_submission_key'] and row['owner_id'] == user]
            if existing:
                return httpx.Response(200,json=existing[0]['id'])
            row = {'id': str(uuid4()), 'submission_key': payload['p_submission_key'], 'owner_id': user, 'category': payload['p_category'], 'fields': payload['p_fields'], 'contact_email': payload['p_contact_email'], 'report_id': payload['p_report_id'], 'created_at': '2026-10-23T10:01:00+00:00'}
            state['feedback'].append(row)
            return httpx.Response(200,json=row['id'])
        if request.url.path == '/rest/v1/feedback_submissions':
            assert request.url.params['owner_id'] == f'eq.{owner}'
            rows = [row for row in state['feedback'] if row['owner_id'] == owner]
            return httpx.Response(200,json=rows,headers={'Content-Range':f'0-0/{len(rows)}'})
        if request.url.path == '/rest/v1/profiles':
            assert request.url.params['id'] == f'eq.{owner}'
            if request.method == 'PATCH':
                payload = json.loads(request.content)
                assert set(payload) == {'history_retention', 'animation'}
                state['preferences'] = payload
                return httpx.Response(204)
            return httpx.Response(200, json=[{'id': other if state['wrong_owner'] else owner, **state['preferences']}])
        if request.url.path == '/rest/v1/scan_reports':
            params = request.url.params
            assert params['owner_id'] == f'eq.{owner}'
            rows = [row for row in records if row['owner_id'] == owner]
            if 'id' in params:
                rows = [row for row in rows if params['id'] == f"eq.{row['id']}"]
            if 'saved_at' in params:
                assert params['saved_at'] == 'not.is.null'
                rows = [row for row in rows if row['saved_at']]
            if 'mode' in params:
                rows = [row for row in rows if params['mode'] == f"eq.{row['mode']}"]
            if 'safe_label' in params:
                term = params['safe_label'][7:-1].lower()
                rows = [row for row in rows if term in row['safe_label'].lower()]
            if request.method == 'DELETE':
                assert request.headers['prefer'] == 'return=representation'
                for row in rows:
                    records.remove(row)
            else:
                rows = sorted(rows, key=lambda row: (row['created_at'], row['id']), reverse='desc' in params['order'] if 'order' in params else False)
                rows = rows[:int(params.get('limit', '100'))]
            if state['wrong_owner']:
                rows = [report(other)]
            return httpx.Response(200, json=rows, headers={'Content-Range': f'0-{max(0,len(rows)-1)}/{state.get("export_total",len(rows))}'})
        payload = json.loads(request.content)
        if request.url.path.endswith('/save_scan_report'):
            assert payload['p_consent'] is True
            rows = [row for row in records if row['id'] == payload['p_report_id'] and row['owner_id'] == owner and row['status'] == 'completed' and state['preferences']['history_retention'] == 'manual']
            for row in rows:
                row['saved_at'] = row['saved_at'] or '2026-10-23T10:01:00+00:00'
            return httpx.Response(200, json=rows)
        if request.url.path.endswith('/clear_scan_history'):
            assert payload == {'p_confirm': True}
            if state['malformed_clear']:
                return httpx.Response(200, text='invalid json')
            rows = [row for row in records if row['owner_id'] == owner and row['saved_at']]
            for row in rows:
                records.remove(row)
            return httpx.Response(200, json=len(rows))
        raise AssertionError('Unexpected history provider operation')

    async def verified_identity(token: Annotated[str, Depends(access_token)]):
        if token != 'fixture-token':
            raise HTTPException(401)
        return Identity(id=owner, email='test@example.invalid', role='user', aal='aal1', profile={'id': owner, 'display_name': 'Fixture'})

    app = create_app(configured)
    app.app.dependency_overrides[current_user] = verified_identity
    provider = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with TestClient(app, raise_server_exceptions=False) as client:
        app.app.state.identity = IdentityService(configured, provider)
        app.app.state.identity.resolve = verified_identity
        yield client, {'Authorization': 'Bearer fixture-token'}, state
        client.portal.call(provider.aclose)


def test_history_requires_authenticated_identity(history_api):
    client, _, state = history_api
    for method, path in [('GET', ''), ('POST', ''), ('DELETE', '?confirm=true'), ('GET', f'/{uuid4()}'), ('DELETE', f'/{uuid4()}')]:
        assert client.request(method, f'/api/v1/history{path}', json={'report_id': str(uuid4()), 'consent': True} if method == 'POST' else None).status_code == 401
    assert not state['requests']


def test_list_safe_metadata_filters_and_pagination(history_api):
    client, headers, state = history_api
    response = client.get('/api/v1/history?limit=1&mode=link&search=Fixture&sort=oldest', headers=headers)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    payload = response.json()
    assert len(payload['items']) == 1
    assert not {'owner_id', 'result', 'engine'} & payload['items'][0].keys()
    params = state['requests'][-1].url.params
    assert params['limit'] == '2'
    assert params['order'] == 'created_at.asc,id.asc'
    assert params['safe_label'] == 'ilike.*Fixture*'
    extra = copy.deepcopy(state['rows'][0])
    extra['id'] = str(uuid4())
    state['rows'].append(extra)
    page = client.get('/api/v1/history?limit=1', headers=headers).json()
    assert page['next_cursor']
    date, identifier = decode_cursor(page['next_cursor'])
    assert UUID(identifier) == UUID(page['items'][0]['id'])
    assert date.startswith('2026-10-23')
    assert client.get('/api/v1/history', params={'cursor': page['next_cursor']}, headers=headers).status_code == 200
    assert 'created_at.lt.' in state['requests'][-1].url.params['or']
    assert client.get('/api/v1/history?mode=video', headers=headers).json()['items'] == []


@pytest.mark.parametrize('query', ['search=bad%2Coperator', 'limit=51', 'sort=unknown', 'mode=bad', 'cursor=malformed', 'cursor=W10=', 'cursor=WyIyMDI2LTEwLTIzVDEwOjAwOjAwKzAwOjAwIiwxXQ=='])
def test_invalid_list_queries_rejected(history_api, query):
    client, headers, _ = history_api
    assert client.get(f'/api/v1/history?{query}', headers=headers).status_code == 422


def test_get_preview_and_cross_account_protection(history_api):
    client, headers, state = history_api
    own, other, unsaved, _ = state['rows']
    assert client.get(f"/api/v1/history/{own['id']}", headers=headers).status_code == 200
    for row in [other, unsaved]:
        assert client.get(f"/api/v1/history/{row['id']}", headers=headers).status_code == 404
    assert client.get(f"/api/v1/history/{other['id']}?preview=true", headers=headers).status_code == 404
    assert client.get(f"/api/v1/history/{unsaved['id']}?preview=true", headers=headers).status_code == 200
    assert client.get(f'/api/v1/history/{uuid4()}', headers=headers).status_code == 404


def test_save_consent_provenance_and_no_client_results(history_api):
    client, headers, state = history_api
    _, other, unsaved, unsupported = state['rows']
    body = {'report_id': unsaved['id'], 'consent': True}
    for payload in [{**body, 'consent': False}, {**body, 'result': {'risk': 'low'}}, {**body, 'owner_id': other['owner_id']}]:
        assert client.post('/api/v1/history', json=payload, headers=headers).status_code == 422
    assert unsaved['saved_at'] is None
    assert client.post('/api/v1/history', json={**body, 'report_id': other['id']}, headers=headers).status_code == 404
    assert client.post('/api/v1/history', json={**body, 'report_id': unsupported['id']}, headers=headers).status_code == 409
    response = client.post('/api/v1/history', json=body, headers=headers)
    assert response.status_code == 200 and response.json()['saved_at']
    assert client.post('/api/v1/history', json=body, headers=headers).json()['saved_at'] == response.json()['saved_at']
    unsaved['engine'] = None
    assert client.post('/api/v1/history', json=body, headers=headers).status_code == 503


def test_delete_ownership_clear_confirmation_and_actual_counts(history_api):
    client, headers, state = history_api
    own, other, unsaved, _ = state['rows']
    for row in [other, unsaved]:
        assert client.delete(f"/api/v1/history/{row['id']}", headers=headers).status_code == 404
    for query in ['', '?confirm=false']:
        assert client.delete(f'/api/v1/history{query}', headers=headers).status_code == 422
    assert client.delete(f"/api/v1/history/{own['id']}", headers=headers).json() == {'deleted': 1}
    assert client.delete('/api/v1/history?confirm=true', headers=headers).json() == {'deleted': 0}
    assert other in state['rows'] and unsaved in state['rows']


def test_provider_failure_and_unexpected_owner_fail_closed(history_api):
    client, headers, state = history_api
    state['failure'] = True
    response = client.get('/api/v1/history', headers=headers)
    assert response.status_code == 503 and 'private-database-error' not in response.text
    state['failure'], state['wrong_owner'] = False, True
    assert client.get('/api/v1/history', headers=headers).status_code == 503
    state['wrong_owner'], state['malformed_clear'] = False, True
    assert client.delete('/api/v1/history?confirm=true', headers=headers).status_code == 503


def test_account_preferences_authentication_and_allowed_fields(history_api):
    client, headers, state = history_api
    assert client.get('/api/v1/account/preferences').status_code == 401
    assert client.patch('/api/v1/account/preferences', json=state['preferences']).status_code == 401
    assert client.get('/api/v1/account/export').status_code == 401
    response = client.get('/api/v1/account/preferences', headers=headers)
    assert response.status_code == 200 and response.json() == state['preferences']
    assert response.headers['cache-control'] == 'no-store'
    for payload in [{'animation':'bad','history_retention':'manual'}, {**state['preferences'],'id':str(uuid4())}, {**state['preferences'],'role':'admin'}, {'animation':'reduced'}]:
        assert client.patch('/api/v1/account/preferences', json=payload, headers=headers).status_code == 422
    response = client.patch('/api/v1/account/preferences', json={'history_retention':'disabled','animation':'reduced'}, headers=headers)
    assert response.json() == {'history_retention':'disabled','animation':'reduced'}
    unsaved = state['rows'][2]
    assert client.post('/api/v1/history', json={'report_id':unsaved['id'],'consent':True}, headers=headers).status_code == 409
    state['wrong_owner'] = True
    assert client.get('/api/v1/account/preferences', headers=headers).status_code == 503


def test_account_export_only_complete_authorized_data(history_api):
    client, headers, state = history_api
    response = client.get('/api/v1/account/export', headers=headers)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    data = response.json()
    assert data['profile']['id'] == state['rows'][0]['owner_id']
    assert [row['id'] for row in data['saved_reports']] == [state['rows'][0]['id']]
    assert 'fixture-token' not in response.text
    assert 'owner_id' not in response.text
    assert state['requests'][-1].headers['prefer'] == 'count=exact'
    state['export_total'] = 501
    assert client.get('/api/v1/account/export', headers=headers).status_code == 413
    state['export_total'] = 2  # Provider row limit truncation must never yield a partial export.
    assert client.get('/api/v1/account/export', headers=headers).status_code == 503
    state['export_total'] = 0
    state['rows'].clear()
    assert client.get('/api/v1/account/export', headers=headers).json()['saved_reports'] == []
