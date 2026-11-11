import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.mark.parametrize('method,path', [
    ('PATCH', '/api/v1/profiles/me'),
    ('PATCH', '/api/v1/account/preferences'),
    ('POST', '/api/v1/history'),
    ('POST', '/api/v1/admin/articles'),
])
def test_oversized_json_is_rejected_before_auth_or_validation(settings, method, path):
    with TestClient(create_app(settings)) as client:
        result = client.request(method, path, content=b'{"padding":"' + b'x' * 262144 + b'"}', headers={
            'Content-Type': 'application/json', 'Origin': settings.cors_origins[0],
        })
        assert result.status_code == 413
        assert result.headers['cache-control'] == 'no-store'
        assert result.headers['access-control-allow-origin'] == settings.cors_origins[0]
        assert result.json()['error']['code'] == 'request_too_large'


def test_chunked_body_stops_reading_at_limit_without_content_length(settings):
    async def exercise():
        chunks = [b'x' * 131072, b'x' * 131072, b'x', b'must-not-read']
        reads, sent = [], []

        async def receive():
            chunk = chunks[len(reads)]
            reads.append(len(chunk))
            return {'type': 'http.request', 'body': chunk, 'more_body': True}

        async def send(message):
            sent.append(message)

        await create_app(settings)({'type': 'http', 'method': 'POST', 'path': '/api/v1/admin/articles', 'headers': []}, receive, send)
        assert len(reads) == 3
        assert sent[0]['status'] == 413

    asyncio.run(exercise())


def test_normal_request_and_feedback_specific_limit(settings):
    with TestClient(create_app(settings)) as client:
        assert client.get('/health').status_code == 200
        assert client.patch('/api/v1/profiles/me', json={'display_name': 'Test'}).status_code == 401
        assert client.post('/api/v1/feedback', content=b'x' * 32769).status_code == 413


@pytest.mark.parametrize('path,limit', [('/api/v1/profiles/me', 262144), ('/api/v1/feedback', 32768)])
def test_exact_byte_boundary(settings, path, limit):
    with TestClient(create_app(settings)) as client:
        method = 'POST' if path.endswith('feedback') else 'PATCH'
        # Invalid JSON at the boundary reaches normal validation; one more byte is blocked.
        headers = {'Content-Type': 'application/json'}
        assert client.request(method, path, content=b'x' * limit, headers=headers).status_code == 422
        assert client.request(method, path, content=b'x' * (limit + 1), headers=headers).status_code == 413
