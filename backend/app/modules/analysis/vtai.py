"""Read-only VirusTotal AI URL reputation lookup."""

from collections import Counter
from pathlib import Path

import httpx

from app.core.config import Settings

from .historical import ReadOnlyLookup, freshness, shareable_archive_url, timestamp
from .schemas import ProviderCheck
from .url import UrlTarget, parse_url

ENDPOINT = "https://ai.virustotal.com/api/v3/urls/lookup"
PROVIDER = "VirusTotal AI"
LABELS = {
    "clean": "harmless", "unrated": "undetected", "malicious": "malicious",
    "suspicious": "suspicious",
}


def load_vtai_token(settings: Settings) -> str:
    if settings.vtai_agent_token:
        token = settings.vtai_agent_token.get_secret_value().strip()
        if token:
            return token
    if settings.app_env != "development":
        return ""
    try:
        with (Path.home() / ".config" / "vtai" / "token").open(encoding="utf-8") as file:
            return file.read(8193).strip()
    except (OSError, UnicodeError):
        return ""


class VirusTotalAI:
    def __init__(self, client: httpx.AsyncClient, token: str):
        self.reader = ReadOnlyLookup(client, PROVIDER, minute=60, daily=1000)
        self.headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    async def lookup(self, target: UrlTarget) -> ProviderCheck:
        if not shareable_archive_url(target):
            return ProviderCheck(
                provider=PROVIDER, status="skipped",
                limitations=["URL tidak memenuhi aturan privasi lookup. Gunakan URL publik tanpa query atau path sensitif."],
            )
        return await self.reader.get(
            ENDPOINT, target.normalized_url, lambda payload: self.parse(payload, target),
            json_body={"url": target.normalized_url}, headers=self.headers,
        )

    @staticmethod
    def parse(payload: dict, target: UrlTarget) -> ProviderCheck:
        data = payload["data"]
        reported = data["url"]
        if data["type"] != "url" or not isinstance(reported, str) or len(reported) > 4096:
            raise ValueError("Invalid VTAI URL report")
        if parse_url(reported).normalized_url != target.normalized_url:
            raise ValueError("VTAI report URL mismatch")

        stats, detections = data.get("last_analysis_stats", {}), data.get("detections", [])
        coverage = data.get("coverage") or {}
        if not isinstance(stats, dict) or not isinstance(detections, list) or not isinstance(coverage, dict):
            raise ValueError("Invalid VTAI detection metadata")
        engines = coverage.get("engines")
        if engines is not None and (type(engines) is not int or not 0 <= engines <= 10000):
            raise ValueError("Invalid engine coverage")

        categories = set(LABELS.values())
        counts = {}
        for key in categories:
            if key in stats:
                value = stats[key]
                if type(value) is not int or not 0 <= value <= 10000:
                    raise ValueError("Invalid VTAI engine count")
                counts[key] = value
        labels = Counter(LABELS[label] for label in detections if isinstance(label, str) and label in LABELS)
        # Compare only recognized categories, allowing timeout and other provider-specific labels.
        inconsistent = bool(detections and counts and any(counts.get(key, 0) != labels[key] for key in categories))
        if not counts and labels:
            counts = dict(labels)
        inconsistent |= engines is not None and sum(counts.values()) > engines

        limitations = ["Laporan reputasi historis VirusTotal AI. Kondisi halaman saat ini belum diperiksa."]
        verdict = "unknown"
        if inconsistent:
            limitations.append("Statistik dan ringkasan deteksi tidak konsisten. Verdict belum dapat digunakan.")
            counts = {}
        elif counts.get("malicious", 0):
            verdict = "malicious"
        elif counts.get("suspicious", 0):
            verdict = "suspicious"
        elif counts.get("harmless", 0):
            verdict = "no_detection"
        elif counts.get("undetected", 0):
            limitations.append("Mesin tidak memberi penilaian atas URL ini.")

        observed = timestamp(data.get("analysis_date"))
        return ProviderCheck(
            provider=PROVIDER, status="found", specificity="exact_url", observed_at=observed,
            freshness=freshness(observed), verdict=verdict, counts=counts, engine_count=engines,
            categories=sorted(key for key, value in counts.items() if value),
            limitations=limitations,
        )
