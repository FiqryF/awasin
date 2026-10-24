from app.core.exceptions import error_response


class FeedbackBodyLimit:
    """Bound actual bytes, including chunked requests, before JSON parsing."""
    def __init__(self, app, path):
        self.app, self.path = app, path

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['path'] != self.path or scope['method'] != 'POST':
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            body = message.get('body', b'')
            size += len(body)
            if size > 32768:
                return await error_response(413, 'request_too_large', 'Request too large')(scope, receive, send)
            if body:
                chunks.append(body)
            if not message.get('more_body', False):
                break
        consumed = False

        async def limited_receive():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {'type': 'http.request', 'body': b''.join(chunks), 'more_body': False}
            return await receive()
        return await self.app(scope, limited_receive, send)
