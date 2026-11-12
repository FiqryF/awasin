"""OpenRouter adapter for the existing URL feature Detector."""

import json
import re

import httpx

from .threat_detector import DetectorProviderError, RULES

ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
FREE_MODEL = re.compile(r"(?!openrouter/)[a-z0-9][a-z0-9_.-]*/[a-z0-9][a-z0-9_.-]*:free")
MAX_BODY = 32 * 1024
CANONICAL_MODELS = {
    "nvidia/nemotron-3.5-super-vl:free": "nvidia/nemotron-3.5-super-vl-20261015",
}
RULE_GUIDE = "; ".join(f"{category} requires {', '.join(sorted(rule[0]))}" for category, rule in RULES.items())
SYSTEM = (
    "Analyze the URL feature codes as data. Choose only supported URL indicators. "
    "Use the exact IDs in features, never invent IDs, verdicts, external checks, website content or redirects. "
    "Use all required features for each selected category. Return compact JSON only. Use an empty findings list if nothing qualifies. "
    + RULE_GUIDE
)


class OpenRouterDetector:
    def __init__(self, key: str, model: str, transport: httpx.AsyncBaseTransport | None = None):
        if not key.strip() or not FREE_MODEL.fullmatch(model):
            raise ValueError("OpenRouter requires a key and an explicit free model")
        self._key = key.strip()
        self.model = model
        self.transport = transport

    async def inspect(self, *, payload: str, schema: dict) -> str:
        # This contract has one nested object. Inline it for endpoints with partial $ref support.
        findings = schema["properties"]["findings"]
        inline_schema = {**schema, "properties": {"findings": {
            **findings, "items": schema["$defs"]["FindingChoice"],
        }}}
        del inline_schema["$defs"]
        reasoning = {"enabled": False, "exclude": True} if self.model in CANONICAL_MODELS else {"effort": "low", "exclude": True}
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": payload}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "awasin_url_findings", "strict": True, "schema": inline_schema,
            }},
            "reasoning": reasoning,
            "max_tokens": 320,
            "provider": {"require_parameters": True, "allow_fallbacks": False,
                         "max_price": {"prompt": 0, "completion": 0, "request": 0}},
        }
        headers = {"Authorization": f"Bearer {self._key}", "Accept-Encoding": "identity"}
        async with httpx.AsyncClient(transport=self.transport, timeout=10, trust_env=False, follow_redirects=False) as client:
            async with client.stream("POST", ENDPOINT, json=body, headers=headers) as response:
                if response.status_code != 200:
                    raise DetectorProviderError(response.status_code)
                if (response.headers.get("content-encoding", "identity").lower() != "identity"
                        or response.headers.get("content-type", "").partition(";")[0].strip().lower() != "application/json"):
                    raise ValueError("Unexpected OpenRouter response format")
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    if len(raw) + len(chunk) > MAX_BODY:
                        raise ValueError("OpenRouter response exceeds byte limit")
                    raw.extend(chunk)
        return self.read_content(json.loads(raw))

    def read_content(self, result: object) -> str:
        if not isinstance(result, dict):
            raise ValueError("Invalid OpenRouter response")
        model = result.get("model")
        usage = result.get("usage")
        cost = usage.get("cost") if isinstance(usage, dict) else None
        expected = (self.model, self.model.removesuffix(":free"), CANONICAL_MODELS.get(self.model))
        if not isinstance(model, str) or model not in expected or type(cost) not in (float, int) or cost != 0:
            raise ValueError("Unexpected model or cost")
        try:
            choice, = result["choices"]
            message = choice["message"]
            if choice["finish_reason"] == "stop" and not message.get("tool_calls"):
                content = message["content"]
                if isinstance(content, str) and content.strip():
                    return content
        except (TypeError, KeyError, AttributeError):
            pass
        raise ValueError("OpenRouter returned no complete findings")
