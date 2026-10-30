import json
from uuid import UUID
import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from app.main import create_app
from app.modules.identity.router import current_user, service
from app.modules.identity.service import Identity, IdentityService
from app.modules.admin.schemas import DomainInput, ArticleInput, normalize_domain

ADMIN = '11111111-1111-4111-8111-111111111111'
RECORD = '33333333-3333-4333-8333-333333333333'


@pytest.fixture
def admin_api(settings):
    state = {'role':'admin','calls':[], 'code':None, 'status':200}
    def respond(request):
        state['calls'].append(request)
        if state['code']:
            return httpx.Response(state['status'],json={'code':state['code'],'message':'private provider detail'})
        if request.url.path.endswith('/rpc/admin_overview'):
            return httpx.Response(200,json={'feedback_total':0})
        if request.url.path.endswith('/rpc/admin_feedback_page'):
            return httpx.Response(200,json={'items':[],'total':0})
        if request.url.path.endswith('/rpc/admin_mutate'):
            return httpx.Response(200,json={'id':RECORD,'version':2})
        return httpx.Response(200,json=[],headers={'content-range':'*/0'})
    config=settings.model_copy(update={'supabase_url':'https://test.supabase.co','supabase_publishable_key':SecretStr('fixture')})
    provider_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))
    provider=IdentityService(config,provider_client)
    outer=create_app(settings)
    app=outer.app
    app.dependency_overrides[service]=lambda:provider
    def identity():
        return Identity(id=ADMIN,email='admin@example.invalid',role=state['role'],aal='aal1',profile={'id':ADMIN,'display_name':'Fixture admin'})
    app.dependency_overrides[current_user]=identity
    with TestClient(outer) as client:
        yield client,state,{'Authorization':'Bearer fixture-token'}


@pytest.mark.parametrize('path',['overview','feedback','organizations','domains','articles','audit'])
def test_admin_read_authorization(admin_api,path):
    client,state,headers=admin_api
    assert client.get('/api/v1/admin/'+path).status_code==401
    state['role']='user'
    assert client.get('/api/v1/admin/'+path,headers=headers).status_code==403
    assert state['calls']==[]
    state['role']='admin'
    result=client.get('/api/v1/admin/'+path,headers=headers)
    assert result.status_code==200 and result.headers['cache-control']=='no-store'


@pytest.mark.parametrize('raw,expected',[
    (' Example.COM. ','example.com'),('BÜCHER.de','xn--bcher-kva.de'),('faß.de','xn--fa-hia.de'),
    ('portal.example.co.uk','portal.example.co.uk'),('example.com.evil.com','example.com.evil.com'),
    ('tenant.blogspot.com','tenant.blogspot.com'),
])
def test_domain_canonicalization(raw,expected):
    assert normalize_domain(raw)==expected


@pytest.mark.parametrize('raw',['com','co.uk','blogspot.com','localhost','127.0.0.1','https://example.com','example.com:443','user@example.com','bad..com','-bad.com','example.com/path','example.invalid','example.com..'])
def test_invalid_or_suffix_only_domains(raw):
    with pytest.raises(ValueError): normalize_domain(raw)


def test_homographs_not_equated():
    assert normalize_domain('раypal.com') != normalize_domain('paypal.com')


def test_domain_request_normalizes_and_ignores_no_privileged_fields(admin_api):
    client,state,headers=admin_api
    payload={'organization_id':RECORD,'domain':'BÜCHER.de.','evidence_url':'https://example.org/evidence','evidence_description':'Official organization directory entry and reviewed supporting evidence.'}
    response=client.post('/api/v1/admin/domains',json=payload,headers=headers)
    assert response.status_code==201
    data=json.loads(state['calls'][-1].content)
    assert data['p_data']['domain']=='xn--bcher-kva.de'
    assert 'actor_id' not in data and 'reviewed_by' not in data['p_data']
    assert client.post('/api/v1/admin/domains',json={**payload,'status':'verified'},headers=headers).status_code==422
    assert client.post('/api/v1/admin/domains',json={**payload,'evidence_url':'javascript:alert(1)'},headers=headers).status_code==422


@pytest.mark.parametrize('path,body',[
 ('domains',{'domain':'example.com'}),
 ('organizations',{'name':'X','category':'test'}),
 ('articles',{'content':{'title':'<script>unsafe</script>'}}),
])
def test_admin_validation_does_not_contact_provider(admin_api,path,body):
    client,state,headers=admin_api
    assert client.post('/api/v1/admin/'+path,json=body,headers=headers).status_code==422
    assert state['calls']==[]


def test_pagination_filter_and_contact_minimization(admin_api):
    client,state,headers=admin_api
    result=client.get('/api/v1/admin/feedback?offset=20&limit=10&status=new&category=bug&search=login',headers=headers)
    assert result.status_code==200
    payload=json.loads(state['calls'][-1].content)
    assert payload['p_offset']==20 and payload['p_limit']==10 and payload['p_status']=='new'
    assert client.get('/api/v1/admin/feedback?limit=5000',headers=headers).status_code==422
    assert client.get('/api/v1/admin/domains?search=foo,role.eq.admin',headers=headers).status_code==422


def test_status_changes_are_versioned_and_provider_errors_safe(admin_api):
    client,state,headers=admin_api
    path=f'/api/v1/admin/feedback/{RECORD}'
    assert client.patch(path,json={'status':'resolved','note':'Internal note','version':2},headers=headers).status_code==200
    payload=json.loads(state['calls'][-1].content)
    assert payload=={'p_kind':'feedback','p_id':RECORD,'p_data':{'status':'resolved','note':'Internal note'},'p_version':2}
    for code,status in [('23505',409),('40001',409),('23514',422)]:
        state.update(code=code,status=409)
        response=client.patch(path,json={'status':'resolved','note':'','version':2},headers=headers)
        assert response.status_code==status
        assert 'private provider' not in response.text


def test_public_reads_are_always_anonymous_and_published_only(admin_api):
    client,state,headers=admin_api
    assert client.get('/api/v1/education',headers=headers).status_code==200
    request=state['calls'][-1]
    assert request.url.params['status']=='eq.published'
    assert 'authorization' not in request.headers
    assert client.get('/api/v1/education/nonexistent',headers=headers).status_code==404


def test_mutation_user_rejected_even_with_role_payload(admin_api):
    client,state,headers=admin_api
    state['role']='user'
    assert client.post('/api/v1/admin/organizations',json={'name':'test','category':'test','role':'admin'},headers=headers).status_code==403
    assert not state['calls']
