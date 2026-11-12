"""Analyze URL features with an explicitly supplied, independently verified adapter."""

import asyncio
from collections import deque
import re
from time import monotonic
from typing import Annotated, Literal, Protocol
from urllib.parse import unquote

import httpx
from pydantic import Field

from .ai_analyst import AnalystInput, decode_output
from .ai_schema import AIModel, DetectorCategory, DetectorFinding, DetectorResult
from .ai_tickets import GLOBAL_LIMIT, PER_SUBJECT_LIMIT, TTL_SECONDS
from .inspect_url import REFERENCES, domain_identity
from .registry import DomainReference
from .url import UrlTarget

Feature = Literal[
    "http", "https", "assumed_scheme", "ip_literal", "registered_domain", "has_subdomain",
    "deep_subdomain", "nonstandard_port", "idn", "long_path", "encoded_path",
    "credential_path", "credential_parameter", "redirect_parameter", "other_parameter",
    "official_domain", "brand_outside_reference", "similar_domain", "official_name_in_subdomain",
]
KNOWN_PATH = {"login", "signin", "password", "otp", "verify", "verifikasi", "verify-account", "reset-password"}
KNOWN_QUERY = {"password", "otp", "token", "session", "verify", "credential"}
REDIRECT_QUERY = {"redirect", "redirect_uri", "redirect_url", "next", "return_to", "continue", "destination"}


class URLFeature(AIModel):
    id: str
    code: Feature


class DetectorInput(AIModel):
    features: list[URLFeature]
    assessment: AnalystInput


class FindingChoice(AIModel):
    category: DetectorCategory
    feature_ids: list[Annotated[str, Field(pattern=r"^UF-\d{2}$")]] = Field(min_length=1, max_length=4)


class DetectorChoices(AIModel):
    findings: list[FindingChoice] = Field(max_length=5)


class DetectorProvider(Protocol):
    async def inspect(self, *, payload: str, schema: dict) -> str: ...


def build_input(target: UrlTarget, assessment: AnalystInput, registry: tuple[DomainReference, ...] = ()) -> DetectorInput:
    # Only bounded, fixed vocabulary crosses the provider boundary. Names and values stay local.
    codes: list[Feature] = ["https" if target.scheme == "https" else "http"]
    host = target.hostname
    domain = target.registered_domain
    prefix = host.removesuffix("." + domain) if domain and host != domain else ""
    names = {unquote(pair.partition("=")[0]).casefold() for pair in target.query.split("&") if pair}
    path = unquote(target.path).casefold()
    path_words = set(re.split(r"[/_.]", path))
    references = (*registry, *REFERENCES)
    identity, _ = domain_identity(target, references)
    host_tokens = set(re.split(r"[.-]", host))
    if identity == "insufficient_evidence" and domain and any(alias in host_tokens for _, _, alias, _ in references):
        identity = "brand_reference"
    identity_codes: dict[str, Feature] = {
        "reference_match": "official_domain", "brand_reference": "brand_outside_reference",
        "confusable": "similar_domain", "near_spelling": "similar_domain",
        "misleading_subdomain": "official_name_in_subdomain",
    }
    for code, present in (
        ("assumed_scheme", target.scheme_assumed), ("ip_literal", target.is_ip),
        ("registered_domain", domain is not None), ("has_subdomain", bool(prefix)),
        ("deep_subdomain", prefix.count(".") >= 2), ("nonstandard_port", target.port not in (None, 80, 443)),
        ("idn", any(label.startswith("xn--") for label in host.split("."))),
        ("long_path", len(target.path) > 120), ("encoded_path", "%" in target.path),
        ("credential_path", bool(KNOWN_PATH & path_words)),
        ("credential_parameter", bool(KNOWN_QUERY & names)),
        ("redirect_parameter", bool(REDIRECT_QUERY & names)),
        ("other_parameter", bool(names - KNOWN_QUERY - REDIRECT_QUERY)),
    ):
        if present:
            codes.append(code)
    if identity in identity_codes:
        codes.append(identity_codes[identity])
    return DetectorInput(
        features=[URLFeature(id=f"UF-{index:02}", code=code) for index, code in enumerate(codes, 1)],
        assessment=assessment,
    )


RULES = {
    "brand_mismatch": ({"brand_outside_reference"}, "observed", "Nama pada alamat menyerupai merek yang dikenal, tetapi domainnya berbeda dari referensi resmi."),
    "lookalike_domain": ({"similar_domain"}, "observed", "Ejaan domain menyerupai referensi resmi yang berbeda."),
    "subdomain_deception": ({"official_name_in_subdomain"}, "observed", "Nama domain resmi muncul di subdomain alamat lain."),
    "obfuscated_url": ({"encoded_path"}, "observed", "Sebagian path memakai pengodean yang membuat alamat lebih sulit dibaca."),
    "redirect_hint": ({"redirect_parameter"}, "observed", "Alamat memuat parameter yang biasa dipakai untuk pengalihan. Tujuan dan alur pengalihan belum diverifikasi."),
    "credential_lure": ({"credential_path", "brand_outside_reference"}, "suspected", "Kombinasi pola akun dan nama merek pada domain lain patut diperiksa. Pola ini belum membuktikan pencurian kredensial."),
}


def validate_detector(raw: str, payload: DetectorInput) -> list[DetectorFinding]:
    choices = DetectorChoices.model_validate(decode_output(raw))
    features = {item.id: item.code for item in payload.features}
    seen: set[str] = set()
    results = []
    for choice in choices.findings:
        required, assessment, description = RULES[choice.category]
        ids = set(choice.feature_ids)
        if (choice.category in seen or len(ids) != len(choice.feature_ids) or not ids <= features.keys()
                or {features[id] for id in ids} != required):
            raise ValueError("Unsupported Detector claim")
        seen.add(choice.category)
        results.append(DetectorFinding(category=choice.category, assessment=assessment,
                                       description=description, feature_ids=choice.feature_ids))
    return results


class DetectorProviderError(Exception):
    def __init__(self, status: int):
        self.status = status


class ThreatDetector:
    def __init__(self, enabled: bool, provider: DetectorProvider | None = None):
        self.enabled = enabled
        self.provider = provider
        self.slots = asyncio.Semaphore(2)
        self.admissions: deque[tuple[float, str]] = deque()
        self.cooldown_until = 0.0

    async def detect(self, payload: DetectorInput, subject: str, *, consent: bool = False) -> DetectorResult | None:
        if consent is not True:
            return None
        if not self.enabled:
            return DetectorResult(status="disabled")
        if self.provider is None:
            return DetectorResult(status="unavailable")
        now = monotonic()
        while self.admissions and self.admissions[0][0] <= now:
            self.admissions.popleft()
        if (self.slots.locked() or now < self.cooldown_until or len(self.admissions) >= GLOBAL_LIMIT
                or sum(owner == subject for _, owner in self.admissions) >= PER_SUBJECT_LIMIT):
            return DetectorResult(status="rate_limited")
        self.admissions.append((now + TTL_SECONDS, subject))
        try:
            async with self.slots, asyncio.timeout(10):
                raw = await self.provider.inspect(payload=payload.model_dump_json(exclude_none=True),
                                                  schema=DetectorChoices.model_json_schema())
        except (TimeoutError, httpx.TimeoutException):
            return DetectorResult(status="timeout")
        except DetectorProviderError as error:
            if error.status == 429:
                self.cooldown_until = monotonic() + 15
                return DetectorResult(status="rate_limited")
            return DetectorResult(status="unavailable")
        except (ValueError, RecursionError):
            return DetectorResult(status="validation_failed")
        except Exception:
            return DetectorResult(status="unavailable")
        try:
            return DetectorResult(status="completed", findings=validate_detector(raw, payload))
        except (ValueError, RecursionError):
            return DetectorResult(status="validation_failed")
