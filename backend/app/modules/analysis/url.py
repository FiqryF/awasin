"""Offline parsing and provider contracts for URL-based analysis."""
from dataclasses import dataclass
from datetime import datetime
from ipaddress import IPv6Address, ip_address
from typing import Literal, Protocol
from unicodedata import category
from urllib.parse import urlsplit, urlunsplit

import idna

from app.core.domains import suffixes

from .schemas import Evidence


@dataclass(frozen=True, slots=True, repr=False)
class UrlTarget:
    normalized_url: str
    scheme: str
    hostname: str
    port: int | None
    path: str
    query: str
    registered_domain: str | None
    is_ip: bool
    scheme_assumed: bool = False


def parse_url(value: str, *, allow_domain: bool = False) -> UrlTarget:
    """Validate URL syntax and literal targets without resolving DNS or opening connections."""
    value = value.strip(" ")
    assumed = bool(allow_domain and value and not value.startswith(("/", "?", "#")) and ":" not in value)
    if assumed:
        value = "https://" + value
    if any(char.isspace() or category(char).startswith("C") or char == "\\" for char in value):
        raise ValueError("Invalid URL characters")
    parts = urlsplit(value)
    host = parts.hostname
    if parts.scheme not in {"http", "https"} or not host or any(c in parts.netloc for c in "@%"):
        raise ValueError("Invalid URL authority")
    port = parts.port
    if parts.netloc.endswith(":") or port == 0:
        raise ValueError("Invalid URL port")
    if "[" in parts.netloc:
        prefix = f"[{host}]"
        if not parts.netloc.lower().startswith(prefix) or (
            parts.netloc[len(prefix):] and not parts.netloc[len(prefix):].startswith(":")
        ):
            raise ValueError("Invalid IP literal")
    is_ip = False
    try:
        address = ip_address(host)
    except ValueError:
        if "[" in parts.netloc:
            raise ValueError("Invalid IP literal") from None
        hostname = idna.encode(host, uts46=True, std3_rules=True).decode("ascii").rstrip(".")
        labels = hostname.split(".")
        if (
            len(labels) < 2
            or not labels[-1][0].isalpha()
            or labels[-1].startswith("0x")
            or labels[-1] in {"localhost", "local", "internal", "invalid", "test"}
            or hostname.endswith(".home.arpa")
        ):
            raise ValueError("Invalid public hostname") from None
    else:
        is_ip = True
        checked = (address.ipv4_mapped or address) if isinstance(address, IPv6Address) else address
        if not checked.is_global or checked.is_multicast:
            raise ValueError("Nonpublic IP address")
        hostname = f"[{address}]" if isinstance(address, IPv6Address) else str(address)
    authority = f"{hostname}:{port}" if port is not None else hostname
    normalized = urlunsplit((parts.scheme, authority, parts.path or "/", parts.query, ""))
    if "?" in value.split("#", 1)[0] and not parts.query:
        normalized += "?"
    domain = suffixes(hostname).top_domain_under_public_suffix if not is_ip else ""
    return UrlTarget(
        normalized, parts.scheme, hostname.strip("[]"), port, parts.path or "/",
        parts.query, domain or None, is_ip, assumed,
    )


def public_url(value: str, *, allow_domain: bool = False) -> str:
    return parse_url(value, allow_domain=allow_domain).normalized_url


LookupStatus = Literal["match", "no_match", "unavailable", "not_requested", "unsupported", "timeout", "rate_limited", "invalid_response"]


@dataclass(frozen=True, slots=True)
class Lookup:
    status: LookupStatus
    checked_at: datetime | None = None
    types: tuple[str, ...] = ()


class ThreatIntelligenceProvider(Protocol):
    name: str

    async def lookup_url(self, target: UrlTarget) -> Lookup: ...


class DomainReputationSource(Protocol):
    async def lookup_domain(self, target: UrlTarget) -> tuple[Evidence, ...]: ...


class DomainImpersonationAnalyzer(Protocol):
    async def inspect_domain(self, target: UrlTarget) -> tuple[Evidence, ...]: ...
