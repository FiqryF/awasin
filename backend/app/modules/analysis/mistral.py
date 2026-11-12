"""Mistral chat completions for AWASIN's structured explanation."""

import json
import re

import httpx

ENDPOINT = "https://api.mistral.ai/v1/chat/completions"
MODEL_ID = re.compile(r"(?:ministral|mistral)-[a-z0-9][a-z0-9.-]{0,63}")
TIMEOUT_SECONDS = 8
MAX_RESPONSE_BYTES = 32 * 1024


class InvalidAnalystResponse(ValueError):
    pass


class MistralHTTPError(Exception):
    def __init__(self, status: int):
        super().__init__(f"Mistral HTTP {status}")
        self.status = status


async def read_response(response: httpx.Response) -> str:
    if response.status_code != 200:
        raise MistralHTTPError(response.status_code)
    if (response.headers.get("content-type", "").partition(";")[0].strip().lower() != "application/json"
            or response.headers.get("content-encoding", "identity").lower() != "identity"):
        raise InvalidAnalystResponse("Unexpected provider response format")
    body = bytearray()
    async for chunk in response.aiter_bytes():
        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
            raise InvalidAnalystResponse("Provider response exceeds byte limit")
        body.extend(chunk)
    try:
        choices = json.loads(body)["choices"]
        if not isinstance(choices, list) or len(choices) != 1:
            raise InvalidAnalystResponse("Expected one provider choice")
        choice = choices[0]
        message = choice["message"]
        content = message["content"]
        if choice["finish_reason"] != "stop" or message.get("tool_calls") or not isinstance(content, str) or not content.strip():
            raise InvalidAnalystResponse("Expected a complete text response")
        return content
    except (KeyError, TypeError, AttributeError) as exc:
        raise InvalidAnalystResponse("Unexpected provider response shape") from exc


class MistralGenerator:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        self.transport = transport

    async def generate(self, *, key: str, model: str, instruction: str, payload: str, schema: dict) -> str:
        body = {
            "model": model,
            "messages": [{"role": "system", "content": instruction}, {"role": "user", "content": payload}],
            "max_tokens": 700,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "awasin_evidence", "schema": schema, "strict": True},
            },
        }
        headers = {"Authorization": f"Bearer {key}", "Accept-Encoding": "identity"}
        async with httpx.AsyncClient(
            transport=self.transport, timeout=TIMEOUT_SECONDS, trust_env=False, follow_redirects=False,
        ) as client:
            async with client.stream("POST", ENDPOINT, json=body, headers=headers) as response:
                return await read_response(response)
