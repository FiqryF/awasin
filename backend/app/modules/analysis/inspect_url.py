import asyncio
from datetime import UTC, datetime
import re
import unicodedata
from urllib.parse import unquote, urlsplit

import idna

from app.core.domains import suffixes

from .historical import DomainIntelligence, Urlscan, VirusTotal
from .orchestrator import AnalysisInput
from .registry import DomainReference
from .schemas import EngineResult, Evidence, ProviderCheck, Provenance, UrlReport
from .safe_browsing import NAME as SAFE_BROWSING_NAME
from .url import Lookup, ThreatIntelligenceProvider, UrlTarget, parse_url

VERSION = "10b.2-c2"
REFERENCES = (
    ("BCA", "bca.co.id", "bca", "https://www.bca.co.id/id/individu"),
    ("Bank Indonesia", "bi.go.id", "bankindonesia", "https://www.bi.go.id/id/default.aspx"),
)
CONFUSABLE = str.maketrans("аевіјорсухѕαειοπԁһӏ", "aebijopcyxsaeiopdhl")
MIXED_SCRIPTS = {"LATIN", "CYRILLIC", "GREEK"}
CONTEXT_ONLY = {"account_path", "long_url", "encoded_components", "mixed_script_hostname"}
REDIRECT_KEYS = {
    "redirect", "redirect_uri", "redirect_url", "return", "return_url", "return_to",
    "next", "url", "continue", "destination", "callback",
}
ACCOUNT_PATH = re.compile(r"(?:^|[/_.-])(?:login|signin|password|otp|verify|verifikasi)(?:$|[/_.-])", re.I)


def has_cross_domain_redirect(target: UrlTarget) -> bool:
    origin = target.registered_domain or target.hostname
    for pair in target.query.split("&"):
        key, _, value = pair.partition("=")
        if unquote(key).casefold() not in REDIRECT_KEYS:
            continue
        for _ in range(3):  # Literal form and at most two percent-decoding passes.
            candidate = value.strip(" ")
            if candidate.startswith("//"):
                candidate = target.scheme + ":" + candidate
            if candidate.lower().startswith(("http://", "https://")):
                try:
                    destination = parse_url(candidate)
                except ValueError:
                    break
                if (destination.registered_domain or destination.hostname) != origin:
                    return True
                break
            decoded = unquote(value)
            if decoded == value:
                break
            value = decoded
    return False


def has_mixed_script_label(hostname: str) -> bool:
    for label in hostname.split("."):
        if label.startswith("xn--"):
            scripts = {unicodedata.name(char, "").split(" ", 1)[0] for char in idna.decode(label)}
            if len(scripts & MIXED_SCRIPTS) > 1:
                return True
    return False


def local_signals(target: UrlTarget) -> dict[str, str]:
    findings = {}
    prefix = target.hostname.removesuffix("." + target.registered_domain) if target.registered_domain else ""
    if target.registered_domain and prefix != target.registered_domain and prefix.count(".") >= 2:
        findings["deep_subdomains"] = "Beberapa subdomain mendahului domain terdaftar. Nama di sebelah kiri dapat mengaburkan tujuan tautan."
    if target.is_ip:
        findings["ip_literal"] = "Tautan memakai alamat IP publik. Identitas organisasi tidak terlihat dari nama domain."
    if target.port is not None and target.port != {"http": 80, "https": 443}[target.scheme]:
        findings["nonstandard_port"] = "Alamat menentukan port selain port standar skemanya. Pastikan port itu memang dipakai layanan resmi."
    if len(target.normalized_url) > 250:
        findings["long_url"] = "Alamat melebihi 250 karakter. Bagian tujuan bisa sulit ditinjau secara manual."
    components = target.path + "?" + target.query
    if re.search(r"%(?:25)?(?:00|0a|0d)", components, re.I):
        findings["encoded_controls"] = "Path atau kueri memuat karakter kontrol yang tersandi. Cara sistem tujuan menanganinya belum diketahui."
    elif re.search(r"%(?:25|40|2f|5c)|@", components, re.I):
        findings["encoded_components"] = "Path atau kueri mengandung pemisah tersandi atau simbol @ yang dapat menyulitkan pembacaan alamat."
    if ACCOUNT_PATH.search(unquote(target.path)):
        findings["account_path"] = "Path menyebut tindakan akun seperti login atau verifikasi. Periksa domain sebelum memasukkan data."
    if has_cross_domain_redirect(target):
        findings["redirect_parameter"] = "Parameter pengalihan menunjuk ke domain lain. AWASIN memeriksa bentuk alamat tanpa menjalankan pengalihan."
    if has_mixed_script_label(target.hostname):
        findings["mixed_script_hostname"] = "Satu label hostname mencampur aksara Latin, Kiril, atau Yunani. Penggunaan beberapa aksara dapat sah."
    return findings


def single_edit(left: str, right: str) -> bool:
    if len(left) == len(right):
        changes = [i for i, (a, b) in enumerate(zip(left, right)) if a != b]
        if len(changes) == 2:
            first, second = changes
            return second == first + 1 and left[first] == right[second] and left[second] == right[first]
        return len(changes) == 1
    shorter, longer = sorted((left, right), key=len)
    if len(longer) - len(shorter) != 1:
        return False
    mismatch = next((i for i, (a, b) in enumerate(zip(shorter, longer)) if a != b), len(shorter))
    return shorter[mismatch:] == longer[mismatch + 1:]


def domain_identity(target: UrlTarget, references: tuple[DomainReference, ...] = REFERENCES) -> tuple[str, DomainReference | None]:
    if target.is_ip:
        return "insufficient_evidence", None
    for reference in references:
        _, domain, _, _ = reference
        if target.hostname == domain or (
            target.registered_domain and target.hostname.endswith("." + domain)
            and target.registered_domain == suffixes(domain).top_domain_under_public_suffix
        ):
            return "reference_match", reference
    if not target.registered_domain:
        return "insufficient_evidence", None
    prefix = target.hostname.removesuffix("." + target.registered_domain)
    subdomains = idna.decode(prefix).split(".") if prefix != target.registered_domain else ()
    registrable_label = idna.decode(target.registered_domain.split(".")[0])
    skeleton = unicodedata.normalize("NFKC", registrable_label).casefold().translate(CONFUSABLE)
    weak_match = ("insufficient_evidence", None)
    for reference in references:
        _, domain, alias, _ = reference
        if ("." + domain + ".") in ("." + target.hostname + "."):
            return "misleading_subdomain", reference
        if skeleton == alias and registrable_label != alias:
            return "confusable", reference
        if weak_match[1] is None:
            if skeleton == alias or alias in registrable_label.split("-") or alias in subdomains:
                weak_match = ("brand_reference", reference)
            elif len(alias) >= 6 and single_edit(skeleton, alias):
                weak_match = ("near_spelling", reference)
    return weak_match


class UrlInspector:
    def __init__(
        self, provider: ThreatIntelligenceProvider | None = None, *,
        virustotal: VirusTotal | None = None, urlscan: Urlscan | None = None,
        domain_intelligence: DomainIntelligence | None = None, registry: tuple[DomainReference, ...] = (),
    ):
        self.provider = provider
        self.virustotal = virustotal
        self.urlscan = urlscan
        self.domain_intelligence = domain_intelligence
        self.registry = registry

    async def analyze(self, request: AnalysisInput) -> EngineResult:
        target = request.url_target
        if target is None:
            raise ValueError("Parsed URL required")
        return await self.inspect(target, request.threat_lookup_consent, request.enhanced_lookup_consent)

    async def _primary(self, target: UrlTarget, consent: bool) -> Lookup:
        if self.provider and consent:
            return await self.provider.lookup_url(target)
        return Lookup("unavailable" if not self.provider else "not_requested")

    async def _history(self, target: UrlTarget, dns: ProviderCheck) -> list[ProviderCheck]:
        if dns.status != "found" or not any(item.startswith(("A ", "AAAA ")) for item in dns.details) or dns.limitations:
            reason = "Resolusi DNS publik belum dapat dikonfirmasi. Pencarian arsip dilewati."
            return [ProviderCheck(provider=name, status="skipped", limitations=[reason])
                    for name in ("VirusTotal", "urlscan.io")]
        async def lookup(name, adapter):
            if adapter is None:
                return ProviderCheck(provider=name, status="unavailable")
            return await adapter.lookup(target)

        return list(await asyncio.gather(lookup("VirusTotal", self.virustotal), lookup("urlscan.io", self.urlscan)))

    async def _supplementary(self, target: UrlTarget, consent: bool) -> list[ProviderCheck]:
        names = ("VirusTotal", "urlscan.io", "DNS", "RDAP")
        domain = target.registered_domain
        if not consent or not domain:
            reason = "Persetujuan tambahan belum diberikan." if not consent else "Alamat tidak memiliki domain terdaftar yang didukung."
            return [ProviderCheck(provider=name, status="skipped", limitations=[reason]) for name in names]
        if not self.domain_intelligence:
            return [ProviderCheck(provider=name, status="unavailable") for name in names]

        async def dns_and_history():
            dns = await self.domain_intelligence.lookup_dns(domain)
            return dns, await self._history(target, dns)

        (dns, history), rdap = await asyncio.gather(dns_and_history(), self.domain_intelligence.lookup_rdap(domain))
        return [*history, dns, rdap]

    async def inspect(self, target: UrlTarget, lookup_consent: bool = False, enhanced_consent: bool = False) -> EngineResult:
        now = datetime.now(UTC)
        signals = local_signals(target)
        identity, reference = domain_identity(target, (*self.registry, *REFERENCES))
        if identity == "confusable":
            signals.pop("mixed_script_hostname", None)
        evidence = [
            Evidence(code=code, kind="structure", explanation=description, source="Struktur URL",
                     observed_at=now, validation="verified", limitations=["Ciri struktur ini tidak membuktikan phishing."])
            for code, description in signals.items()
        ]
        if reference:
            brand, domain, _, source = reference
            is_reference = identity == "reference_match"
            text = (
                f"Hostname berada di bawah referensi resmi {brand} ({domain})."
                if is_reference else f"Nama pada alamat menyerupai referensi resmi {brand} ({domain}) tetapi domainnya berbeda."
            )
            evidence.append(Evidence(code=identity, kind="identity", explanation=text, source=source,
                                     observed_at=now, validation="verified",
                                     limitations=["Hubungan nama domain tidak memverifikasi keamanan atau pemilik halaman yang diperiksa."]))
        provider_name = self.provider.name if self.provider else SAFE_BROWSING_NAME
        lookup, checks = await asyncio.gather(
            self._primary(target, lookup_consent), self._supplementary(target, enhanced_consent),
        )
        if lookup.status == "match":
            evidence.append(Evidence(
                code="threat_match", kind="intelligence",
                explanation=f"{provider_name} menemukan kecocokan pada daftar ancaman yang diperiksa.",
                indicator=", ".join(lookup.types), source=provider_name,
                observed_at=lookup.checked_at or now, validation="verified", severity="high",
                limitations=["Cakupan dan akurasi daftar ancaman tidak dapat dijamin."],
            ))
        historical_alerts = [
            check for check in checks
            if check.specificity == "exact_url" and check.verdict in {"malicious", "suspicious"}
        ]
        corroborated_history = False
        for check in historical_alerts:
            if check.observed_at is not None:
                verified_report = (check.provider == "VirusTotal" and check.freshness == "recent"
                                   and check.counts.get("malicious", 0) >= 2)
                corroborated_history |= verified_report
                evidence.append(Evidence(
                    code="historical_alert", kind="historical",
                    explanation=f"{check.provider} melaporkan indikator pada arsip untuk URL yang sama.",
                    source=check.provider, observed_at=check.observed_at,
                    validation="verified" if verified_report else "unverified",
                    severity="medium" if verified_report else "unknown",
                    limitations=check.limitations,
                ))
        strong = identity in {"misleading_subdomain", "confusable"}
        suspicious_identity = reference is not None and identity != "reference_match"
        limitations = [
            "Konten halaman website tidak diperiksa.",
            "Pencocokan identitas terbatas pada referensi resmi yang tersedia.",
        ]
        if target.scheme_assumed:
            limitations.append("HTTPS dipakai sebagai asumsi untuk input tanpa skema. Protokol situs belum diperiksa.")
        if lookup.status == "no_match":
            limitations.append("Tidak ada kecocokan pada kategori yang diperiksa. Cakupan daftar ancaman terbatas.")
        elif lookup.status != "match":
            limitations.append(f"Pemeriksaan ini tidak memperoleh hasil dari daftar ancaman {provider_name}.")
        if lookup.status == "match" and identity == "reference_match":
            limitations.append("Kecocokan identitas organisasi tidak menghapus temuan dari daftar ancaman.")
        if lookup.status == "no_match" and historical_alerts:
            limitations.append("Daftar Google dan arsip historis memberi hasil berbeda. Waktu, sumber, dan cakupan pemeriksaannya berbeda.")
        if lookup.status == "match":
            status, risk, summary = "completed", "high", f"Alamat cocok dengan daftar ancaman {provider_name}. Akurasi daftar tidak dapat dijamin."
        elif strong:
            status, risk, summary = "completed", "medium", "Nama domain menunjukkan indikasi kuat peniruan. Kepemilikan situs belum terverifikasi."
        elif corroborated_history:
            status, risk, summary = "completed", "medium", "Beberapa mesin dalam laporan historis VirusTotal terbaru menandai URL ini. Status website saat ini belum terverifikasi."
        elif signals.keys() - CONTEXT_ONLY or suspicious_identity or historical_alerts:
            status, risk, summary = "partial", "unknown", "Ada indikator pada alamat yang layak ditinjau. Bukti belum cukup untuk menilai tingkat risiko."
        elif signals:
            status, risk, summary = "inconclusive", "unknown", "Detail struktur alamat tersedia. Bukti belum cukup untuk menilai risiko."
        else:
            status, risk, summary = "inconclusive", "unknown", "Tidak ditemukan indikator ancaman dari pemeriksaan yang berhasil dilakukan. Hasil ini tidak menjamin website aman."
        address = urlsplit(target.normalized_url)
        return EngineResult(
            status=status, risk=risk, explanation=summary, evidence=evidence, limitations=limitations,
            provenance=Provenance(engine="AWASIN URL Inspector", version=VERSION, source_type="url_structure_and_identity", checked_at=now),
            url_report=UrlReport(
                display_url=f"{address.scheme}://{address.netloc}", registered_domain=target.registered_domain,
                scheme_assumed=target.scheme_assumed,
                components_hidden=address.path not in {"", "/"} or "?" in target.normalized_url,
                threat_status=lookup.status, threat_checked_at=lookup.checked_at, threat_provider=provider_name,
                identity_status="possible_impersonation" if strong else "name_similarity" if suspicious_identity else identity,
                supplementary_checks=checks, registry_snapshot_used=reference is not None and reference in self.registry,
                recommendations=[
                    "Buka layanan dari kanal resmi yang kamu peroleh secara terpisah.",
                    "Tunda memasukkan kata sandi, OTP, atau data pribadi sampai tujuan tautan terverifikasi.",
                ],
            ),
        )
