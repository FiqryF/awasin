"""Bounded admin contracts. Content is inert structured text, never arbitrary HTML."""
import re
from ipaddress import ip_address
from typing import Literal
from uuid import UUID
from urllib.parse import urlsplit

import idna
import tldextract
import json
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Offline bundled Public Suffix List: no runtime DNS, HTTP, or candidate discovery.
suffixes = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None, include_psl_private_domains=True)


def normalize_domain(value: str) -> str:
    raw = value.strip()
    if any(c in raw for c in '/:@?#\\') or raw.endswith('..'):
        raise ValueError('Isi hostname saja, tanpa URL, port, atau path.')
    raw = raw.removesuffix('.')
    try:
        host = idna.encode(raw, uts46=True, transitional=False, std3_rules=True).decode('ascii').lower()
    except idna.IDNAError:
        raise ValueError('Hostname/IDN tidak valid.') from None
    try:
        ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError('Alamat IP bukan domain organisasi.')
    parts = suffixes(host)
    if len(host) > 253 or not parts.suffix or not parts.domain:
        raise ValueError('Domain harus memiliki nama registrable dan public suffix yang dikenal.')
    return host


def safe_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in value):
        raise ValueError('Gunakan URL sumber HTTPS tanpa kredensial.')
    return value


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Versioned(Strict):
    version: int = Field(ge=1)


class Organization(Strict):
    name: str = Field(min_length=2, max_length=160)
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(default='', max_length=2000)


class DomainInput(Strict):
    organization_id: UUID
    domain: str = Field(min_length=3, max_length=500)
    evidence_url: str = Field(min_length=8, max_length=2000)
    evidence_description: str = Field(min_length=20, max_length=4000)

    _normalize = field_validator('domain')(normalize_domain)
    _source = field_validator('evidence_url')(safe_url)


class DomainUpdate(DomainInput, Versioned):
    pass


class DomainReview(Versioned):
    status: Literal['verified', 'rejected', 'archived']
    review_note: str = Field(min_length=10, max_length=2000)


class FeedbackReview(Versioned):
    status: Literal['new', 'in_review', 'resolved']
    note: str = Field(default='', max_length=4000)


class Section(Strict):
    title: str = Field(min_length=2, max_length=200)
    paragraphs: list[str] = Field(min_length=1, max_length=20)

    @field_validator('paragraphs')
    @classmethod
    def paragraphs_bounded(cls, values):
        if any(not value.strip() or len(value) > 5000 for value in values):
            raise ValueError('Paragraf harus berisi 1–5000 karakter.')
        return values


class Source(Strict):
    name: str = Field(min_length=2, max_length=200)
    url: str = Field(max_length=2000)
    _safe = field_validator('url')(safe_url)


class ArticleContent(Strict):
    slug: str = Field(min_length=2, max_length=100, pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=10, max_length=1000)
    category: str = Field(min_length=2, max_length=80)
    action: str = Field(default='Baca artikel', max_length=80)
    image: str = Field(default='/assets/education/phishing.jpg', max_length=200)
    sections: list[Section] = Field(min_length=1, max_length=30)
    source: Source
    sources: list[Source] = Field(default_factory=list, max_length=20)

    @field_validator('image')
    @classmethod
    def local_image(cls, value):
        if not re.fullmatch(r'/assets/education/[a-z0-9-]+\.(?:jpg|png|webp)', value):
            raise ValueError('Pilih aset edukasi lokal yang tersedia.')
        return value


class ArticleInput(Strict):
    content: ArticleContent

    @field_validator('content')
    @classmethod
    def bounded_content(cls, value):
        if len(json.dumps(value.model_dump(),ensure_ascii=False).encode())>140000:
            raise ValueError('Artikel melebihi batas ukuran konten.')
        return value


class ArticleUpdate(ArticleInput, Versioned):
    pass


class ArticlePublish(Versioned):
    status: Literal['draft', 'published', 'archived']
