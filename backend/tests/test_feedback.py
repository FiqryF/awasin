from uuid import UUID, uuid4

import pytest
from test_history import history_api  # noqa: F401 - shared isolated provider fixture


def payload(category='other'):
    fields = {'description': 'Fixture text only, not real feedback.'}
    if category == 'detection':
        fields['errorType'] = 'Hasil analisis tidak sesuai / lainnya'
    if category == 'bug':
        fields['feature'] = 'Login/Register'
    if category == 'idea':
        fields['title'] = 'Fixture suggestion'
    return {'submission_key': str(uuid4()), 'category': category, 'fields': fields, 'consent': True}


@pytest.mark.parametrize('category', ['detection','bug','idea','other'])
@pytest.mark.parametrize('authenticated', [False,True])
def test_real_receipt_for_guest_and_authenticated_categories(history_api, category, authenticated):
    client, headers, state = history_api
    body = payload(category)
    response = client.post('/api/v1/feedback',json=body,headers=headers if authenticated else {})
    assert response.status_code == 200
    receipt = response.json()['receipt_id']
    UUID(receipt)
    assert receipt != body['submission_key']
    assert response.headers['cache-control'] == 'no-store'
    assert state['feedback'][0]['owner_id'] == (state['rows'][0]['owner_id'] if authenticated else None)
    assert client.post('/api/v1/feedback',json=body,headers=headers if authenticated else {}).json()['receipt_id'] == receipt
    assert len(state['feedback']) == 1


@pytest.mark.parametrize('change', [
    {'consent':False}, {'consent':1}, {'owner_id':'other'}, {'role':'admin'}, {'category':'invalid'},
    {'fields':{'description':'tiny'}}, {'fields':{'description':'x'*5001}},
    {'fields':{'description':'Fixture enough characters','unexpected':'field'}},
    {'contact_email':'bad@@example.com'}, {'file':'not-supported'},
])
def test_feedback_invalid_input_never_reaches_storage(history_api, change):
    client, _, state = history_api
    assert client.post('/api/v1/feedback',json={**payload(),**change}).status_code == 422
    assert not state['feedback']


def test_reference_requires_authenticated_saved_owner_report(history_api):
    client, headers, state = history_api
    own, other, unsaved, _ = state['rows']
    body = {**payload('detection'),'report_id':own['id']}
    assert client.post('/api/v1/feedback',json=body).status_code == 403
    for row in [other,unsaved]:
        assert client.post('/api/v1/feedback',json={**body,'report_id':row['id']},headers=headers).status_code == 404
    assert not state['feedback']
    assert client.post('/api/v1/feedback',json=body,headers=headers).status_code == 200
    assert state['feedback'][0]['report_id'] == own['id']
    assert own['status'] == 'completed' and own['risk'] is None


def test_invalid_presented_session_does_not_become_guest(history_api):
    client, _, state = history_api
    for header in ['Basic abc','Bearer invalid-token']:
        assert client.post('/api/v1/feedback',json=payload(),headers={'Authorization':header}).status_code == 401
    assert not state['feedback']


def test_feedback_rate_limit_and_size_are_enforced(history_api):
    client, headers, state = history_api
    large = client.post('/api/v1/feedback',content=(chunk for chunk in [b'x'*20000,b'y'*20000]),headers={**headers,'Content-Type':'application/json','Origin':'http://localhost:5173'})
    assert large.status_code == 413
    assert large.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert not state['requests']
    for _ in range(5):
        assert client.post('/api/v1/feedback',json=payload()).status_code == 200
    response = client.post('/api/v1/feedback',json=payload())
    assert response.status_code == 429 and response.headers['retry-after'] == '600'


def test_feedback_storage_errors_never_confirm_receipt(history_api):
    client, _, state = history_api
    state['feedback_status'] = 429
    assert client.post('/api/v1/feedback',json=payload()).status_code == 429
    state['failure'] = True
    response = client.post('/api/v1/feedback',json=payload())
    assert response.status_code == 503
    assert 'receipt_id' not in response.text and 'private-database-error' not in response.text


def test_account_export_includes_only_own_confirmed_feedback(history_api):
    client, headers, state = history_api
    assert client.post('/api/v1/feedback',json=payload(),headers=headers).status_code == 200
    assert client.post('/api/v1/feedback',json=payload()).status_code == 200
    data = client.get('/api/v1/account/export',headers=headers).json()
    assert data['format_version'] == 2 and len(data['feedback']) == 1
    assert 'submission_key' not in data['feedback'][0] and 'owner_id' not in data['feedback'][0]
    assert data['feedback'][0]['id'] == state['feedback'][0]['id']
