"""Load reviewed public registry fields from an explicitly configured local export."""

import json
from pathlib import Path
import re

from app.modules.admin.schemas import normalize_domain

from .historical import timestamp
from .url import parse_url

DomainReference = tuple[str, str, str, str]


def load_registry(path: Path) -> tuple[DomainReference, ...]:
    with path.open("rb") as source:
        data = source.read(65537)
    if len(data) > 65536:
        raise ValueError("Registry snapshot too large")
    rows = json.loads(data)
    if not isinstance(rows, list) or len(rows) > 128:
        raise ValueError("Invalid registry snapshot")
    references = []
    for row in rows:
        if not isinstance(row, dict) or row.get("status") != "verified":
            continue
        name, domain, alias, source = (
            row["organization_name"], normalize_domain(row["domain"]), row["alias"], row["evidence_url"]
        )
        target = parse_url(source)
        if (not isinstance(name, str) or not name.isprintable() or not 1 <= len(name.strip()) <= 100
                or not isinstance(alias, str) or not re.fullmatch(r"[a-z0-9]{3,40}", alias)
                or target.scheme != "https" or not target.registered_domain or target.port is not None
                or "?" in source or len(source) > 160 or timestamp(row.get("verified_at")) is None):
            raise ValueError("Invalid verified registry entry")
        references.append((name.strip(), domain, alias, source))
    return tuple(references)
