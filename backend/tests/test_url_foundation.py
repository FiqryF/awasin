from types import SimpleNamespace
from uuid import uuid4
import asyncio

import pytest

from app.modules.analysis.orchestrator import AnalysisInput, AnalysisOrchestrator
from app.modules.analysis.url import parse_url


@pytest.mark.parametrize("url, host, domain, port", [
    ("http://EXAMPLE.com", "example.com", "example.com", None),
    ("https://login.EXAMPLE.co.uk:8443/p?q=%2f", "login.example.co.uk", "example.co.uk", 8443),
    ("https://bücher.de", "xn--bcher-kva.de", "xn--bcher-kva.de", None),
    ("https://example.com.evil.org", "example.com.evil.org", "evil.org", None),
    ("https://foo.github.io", "foo.github.io", "foo.github.io", None),
    ("https://[2606:4700:4700::1111]:443", "2606:4700:4700::1111", None, 443),
    ("http://1.1.1.1", "1.1.1.1", None, None),
])
def test_offline_domain_details(url, host, domain, port):
    target = parse_url(url)
    assert (target.hostname, target.registered_domain, target.port) == (host, domain, port)
    assert target.is_ip is (domain is None)


@pytest.mark.parametrize("url", [
    "https:example.com", "ftp://example.com", "https://example.com:70000",
    "https://example.com:0", "https://127.0.0.1", "http://[::1]",
    "https://example.com.evil.test", "https://user@example.com",
])
def test_invalid_or_local_url(url):
    with pytest.raises(ValueError):
        parse_url(url)


def test_bare_domain_is_opt_in_and_query_bytes_are_preserved():
    with pytest.raises(ValueError):
        parse_url("example.com/path")
    target = parse_url("EXAMPLE.com/p?q=%2F#ignored", allow_domain=True)
    assert (target.normalized_url, target.path, target.query) == ("https://example.com/p?q=%2F", "/p", "q=%2F")
    assert parse_url("https://example.com?").normalized_url == "https://example.com/?"


@pytest.mark.parametrize("registered_mode", ["link", "website"])
def test_both_historical_modes_dispatch_to_one_adapter(registered_mode):
    seen = []

    async def analyze(request):
        seen.append(request.mode)
        raise RuntimeError("fixture")

    async def check():
        engine = AnalysisOrchestrator({registered_mode: SimpleNamespace(analyze=analyze)})
        for mode in ("link", "website"):
            result = await engine.run(AnalysisInput(mode, uuid4(), None, False))
            assert result.mode == mode
            assert result.error_code == "engine_failed"

    asyncio.run(check())
    assert seen == ["link", "website"]
