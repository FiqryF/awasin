
import asyncio
from datetime import UTC, datetime
from pathlib import Path
import re
import unicodedata
from urllib.parse import unquote, urlsplit

import idna

from app.core.domains import suffixes

from .historical import DomainIntelligence, Urlscan, VirusTotal, freshness
from .orchestrator import AnalysisInput
from .registry import DomainReference
from .schemas import EngineResult, Evidence, ProviderCheck, Provenance, UrlReport
from .safe_browsing import NAME as SAFE_BROWSING_NAME
from .url import Lookup, ThreatIntelligenceProvider, UrlTarget, parse_url
from .vtai import PROVIDER as VTAI_NAME, VirusTotalAI


VERSION = "10b.4"

REFERENCES = (
    ("BCA", "bca.co.id", "bca", "https://www.bca.co.id/id/individu"),
    ("BNI", "bni.co.id", "bni", "https://www.bni.co.id/id-id/beranda/kabar-bni/security-awareness"),
    ("Bank Indonesia", "bi.go.id", "bankindonesia", "https://www.bi.go.id/id/default.aspx"),
)

CONFUSABLE = str.maketrans(
    "аевіјорсухѕαειοπԁһӏ",
    "aebijopcyxsaeiopdhl",
)
DIGIT_LOOKALIKES = {"0": "o", "1": "il", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b"}


def load_unicode_confusables() -> dict[int, str]:
    table = {}
    source = Path(__file__).with_name("unicode-confusables.txt")
    for line in source.read_text(encoding="utf-8").splitlines():
        entry = line.partition("#")[0].strip()
        if entry:
            character, replacement, _ = entry.split(";")
            table[int(character, 16)] = "".join(chr(int(code, 16)) for code in replacement.split())
    return table


UNICODE_CONFUSABLES = load_unicode_confusables()


def confusable_skeleton(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    return unicodedata.normalize("NFD", decomposed.translate(UNICODE_CONFUSABLES))

MIXED_SCRIPTS = {"LATIN", "CYRILLIC", "GREEK"}

CONTEXT_ONLY = {
    "account_path",
    "long_url",
    "encoded_components",
    "mixed_script_hostname",
    "archive_download",
}

REDIRECT_KEYS = {
    "redirect",
    "redirect_uri",
    "redirect_url",
    "return",
    "return_url",
    "return_to",
    "next",
    "url",
    "continue",
    "destination",
    "callback",
}

ACCOUNT_PATH = re.compile(
    r"(?:^|[/_.-])(?:login|signin|password|otp|verify|verifikasi)(?:$|[/_.-])",
    re.I,
)


def has_cross_domain_redirect(target: UrlTarget) -> bool:
    origin = target.registered_domain or target.hostname

    for pair in target.query.split("&"):
        key, _, value = pair.partition("=")

        if unquote(key).casefold() not in REDIRECT_KEYS:
            continue

        for _ in range(3):
            candidate = value.strip(" ")

            if candidate.startswith("//"):
                candidate = target.scheme + ":" + candidate

            if candidate.lower().startswith(("http://", "https://")):
                try:
                    destination = parse_url(candidate)
                except ValueError:
                    break

                if (
                    destination.registered_domain or destination.hostname
                ) != origin:
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
            scripts = {
                unicodedata.name(char, "").split(" ", 1)[0]
                for char in idna.decode(label)
            }

            if len(scripts & MIXED_SCRIPTS) > 1:
                return True

    return False


def local_signals(target: UrlTarget) -> dict[str, str]:
    findings = {}

    prefix = (
        target.hostname.removesuffix("." + target.registered_domain)
        if target.registered_domain
        else ""
    )

    if (
        target.registered_domain
        and prefix != target.registered_domain
        and prefix.count(".") >= 2
    ):
        findings["deep_subdomains"] = (
            "Beberapa subdomain mendahului domain terdaftar. "
            "Nama di sebelah kiri dapat mengaburkan tujuan tautan."
        )

    if target.is_ip:
        findings["ip_literal"] = (
            "Tautan memakai alamat IP publik. "
            "Identitas organisasi tidak terlihat dari nama domain."
        )

    if (
        target.port is not None
        and target.port != {"http": 80, "https": 443}[target.scheme]
    ):
        findings["nonstandard_port"] = (
            "Alamat menentukan port selain port standar skemanya. "
            "Pastikan port itu memang dipakai layanan resmi."
        )

    if len(target.normalized_url) > 250:
        findings["long_url"] = (
            "Alamat melebihi 250 karakter. "
            "Bagian tujuan bisa sulit ditinjau secara manual."
        )

    components = target.path + "?" + target.query

    if re.search(r"%(?:25){0,2}(?:00|0a|0d)", components, re.I):
        findings["encoded_controls"] = (
            "Path atau kueri memuat karakter kontrol yang tersandi. "
            "Cara sistem tujuan menanganinya belum diketahui."
        )
    elif re.search(r"%(?:25|40|2f|5c)|@", components, re.I):
        findings["encoded_components"] = (
            "Path atau kueri mengandung pemisah tersandi atau simbol @ "
            "yang dapat menyulitkan pembacaan alamat."
        )

    path = unquote(unquote(target.path)).casefold()
    filename = path.rsplit("/", 1)[-1]
    if filename.endswith((".zip", ".rar", ".7z", ".tar", ".gz")):
        findings["archive_download"] = "Nama pada alamat berakhiran arsip. Isi file belum diperiksa."
    if filename.endswith((".exe", ".msi", ".scr", ".bat", ".cmd", ".ps1", ".apk", ".vbs")):
        findings["executable_download"] = "Nama pada alamat berakhiran file yang dapat dijalankan. Isi file belum diperiksa."

    if any(unicodedata.category(char) in {"Cf", "Co"} for char in filename):
        findings["obscured_filename"] = "Nama file memuat karakter Unicode pemformatan atau privat yang dapat menyamarkan tampilannya."

    if ACCOUNT_PATH.search(path):
        findings["account_path"] = (
            "Path menyebut tindakan akun seperti login atau verifikasi. "
            "Periksa domain sebelum memasukkan data."
        )

    if has_cross_domain_redirect(target):
        findings["redirect_parameter"] = (
            "Parameter pengalihan menunjuk ke domain lain. "
            "AWASIN memeriksa bentuk alamat tanpa menjalankan pengalihan."
        )

    if has_mixed_script_label(target.hostname):
        findings["mixed_script_hostname"] = (
            "Satu label hostname mencampur aksara Latin, Kiril, atau Yunani. "
            "Penggunaan beberapa aksara dapat sah."
        )

    return findings


def structural_risk(signals: set[str], identity: str) -> tuple[set[str], str]:
    if identity in {"misleading_subdomain", "confusable"}:
        return {identity}, "Alamat menunjukkan indikasi kuat peniruan domain resmi."
    if identity in {"brand_reference", "near_spelling"} and "account_path" in signals:
        return {identity, "account_path"}, "Alamat menyerupai merek pada domain berbeda dan memuat jalur login atau verifikasi."
    downloads = signals & {"archive_download", "executable_download"}
    if downloads and "obscured_filename" in signals:
        return downloads | {"obscured_filename"}, "Tautan unduhan memakai nama file yang disamarkan dengan karakter Unicode."
    if "redirect_parameter" in signals and ("account_path" in signals or downloads):
        return downloads | (signals & {"redirect_parameter", "account_path"}), "Tautan akun atau unduhan memuat parameter menuju domain lain. Tujuan akhirnya belum diperiksa."
    if "encoded_controls" in signals:
        return {"encoded_controls"}, "Alamat memuat karakter kontrol tersandi."
    network_signals = signals & {"ip_literal", "nonstandard_port"}
    if downloads and network_signals:
        return downloads | network_signals, "Alamat unduhan memakai IP langsung atau port tidak standar."
    return set(), ""


def single_edit(left: str, right: str) -> bool:
    if len(left) == len(right):
        changes = [
            i
            for i, (a, b) in enumerate(zip(left, right))
            if a != b
        ]

        if len(changes) == 2:
            first, second = changes
            return (
                second == first + 1
                and left[first] == right[second]
                and left[second] == right[first]
            )

        return len(changes) == 1

    shorter, longer = sorted((left, right), key=len)

    if len(longer) - len(shorter) != 1:
        return False

    mismatch = next(
        (
            i
            for i, (a, b) in enumerate(zip(shorter, longer))
            if a != b
        ),
        len(shorter),
    )

    return shorter[mismatch:] == longer[mismatch + 1:]


def domain_identity(
    target: UrlTarget,
    references: tuple[DomainReference, ...] = REFERENCES,
) -> tuple[str, DomainReference | None]:

    if target.is_ip:
        return "insufficient_evidence", None

    # Prioritaskan domain resmi sebelum memeriksa kemiripan.
    for reference in references:
        _, domain, _, _ = reference

        if target.hostname == domain or (
            target.registered_domain
            and target.hostname.endswith("." + domain)
            and target.registered_domain
            == suffixes(domain).top_domain_under_public_suffix
        ):
            return "reference_match", reference

    if not target.registered_domain:
        return "insufficient_evidence", None

    prefix = target.hostname.removesuffix(
        "." + target.registered_domain
    )

    subdomains = (
        idna.decode(prefix).split(".")
        if prefix != target.registered_domain
        else ()
    )

    # FIX: Pisahkan token subdomain berdasarkan tanda hubung.
    # Contoh:
    # bca-login.example.com -> {"bca", "login"}
    # login-bca.example.com -> {"login", "bca"}
    # mybca.example.com    -> {"mybca"}
    subdomain_tokens = {
        token.casefold()
        for label in subdomains
        for token in label.split("-")
        if token
    }

    registrable_label = idna.decode(
        target.registered_domain.split(".")[0]
    ).casefold()

    skeleton = (
        unicodedata.normalize("NFKC", registrable_label)
        .casefold()
        .translate(CONFUSABLE)
    )

    weak_match = ("insufficient_evidence", None)
    unicode_skeleton = confusable_skeleton(registrable_label) if not registrable_label.isascii() else None

    for reference in references:
        _, domain, alias, _ = reference

        # Nama domain resmi muncul dalam hostname domain lain.
        if ("." + domain + ".") in ("." + target.hostname + "."):
            return "misleading_subdomain", reference

        # Compare digit substitutions positionally so i and l remain distinct.
        digit_lookalike = len(skeleton) == len(alias) and all(
            char == letter or letter in DIGIT_LOOKALIKES.get(char, "")
            for char, letter in zip(skeleton, alias)
        )
        # Deteksi karakter domain yang menyerupai merek.
        if registrable_label != alias and (
            digit_lookalike or (unicode_skeleton is not None and unicode_skeleton == confusable_skeleton(alias))
        ):
            return "confusable", reference

        if weak_match[1] is None:

            # FIX: Tambahkan pencocokan token subdomain.
            # Ini hanya menghasilkan sinyal brand_reference,
            # bukan langsung menyatakan URL sebagai phishing.
            if (
                skeleton == alias
                or alias in registrable_label.split("-")
                or alias in subdomain_tokens
            ):
                weak_match = ("brand_reference", reference)

            elif len(alias) >= 6 and single_edit(skeleton, alias):
                weak_match = ("near_spelling", reference)

    return weak_match


class UrlInspector:
    def __init__(
        self,
        provider: ThreatIntelligenceProvider | None = None,
        *,
        virustotal: VirusTotal | None = None,
        vtai: VirusTotalAI | None = None,
        urlscan: Urlscan | None = None,
        domain_intelligence: DomainIntelligence | None = None,
        registry: tuple[DomainReference, ...] = (),
    ):
        self.provider = provider
        self.virustotal = virustotal
        self.vtai = vtai
        self.urlscan = urlscan
        self.domain_intelligence = domain_intelligence
        self.registry = registry

    async def analyze(
        self,
        request: AnalysisInput,
    ) -> EngineResult:
        target = request.url_target

        if target is None:
            raise ValueError("Parsed URL required")

        return await self.inspect(
            target,
            request.threat_lookup_consent,
            request.enhanced_lookup_consent,
        )

    async def _primary(
        self,
        target: UrlTarget,
        consent: bool,
    ) -> Lookup:

        if not consent:
            return Lookup("not_requested")
        if self.provider:
            return await self.provider.lookup_url(target)

        return Lookup(
            "unavailable"
        )

    async def _history(
        self,
        target: UrlTarget,
        dns: ProviderCheck,
    ) -> list[ProviderCheck]:

        if (
            dns.status != "found"
            or not any(
                item.startswith(("A ", "AAAA "))
                for item in dns.details
            )
            or dns.limitations
        ):
            reason = (
                "Resolusi DNS publik belum dapat dikonfirmasi. "
                "Pencarian arsip dilewati."
            )

            checks = [
                ProviderCheck(
                    provider=name,
                    status="skipped",
                    limitations=[reason],
                )
                for name in ("VirusTotal", "urlscan.io")
            ]
            if self.urlscan and dns.status in {"timeout", "unavailable", "rate_limited", "error", "not_found"}:
                checks[1] = await self.urlscan.lookup(target, domain_only=True)
            return checks

        async def lookup(name, adapter):
            if adapter is None:
                return ProviderCheck(
                    provider=name,
                    status="unavailable",
                )

            return await adapter.lookup(target)

        return list(
            await asyncio.gather(
                lookup("VirusTotal", self.virustotal),
                lookup("urlscan.io", self.urlscan),
            )
        )

    async def _supplementary(
        self,
        target: UrlTarget,
        consent: bool,
    ) -> list[ProviderCheck]:

        names = ("VirusTotal", "urlscan.io", "DNS", "RDAP")
        domain = target.registered_domain

        if not consent or not domain:
            reason = (
                "Persetujuan tambahan belum diberikan."
                if not consent
                else "Alamat tidak memiliki domain terdaftar yang didukung."
            )

            return [
                ProviderCheck(
                    provider=name,
                    status="skipped",
                    limitations=[reason],
                )
                for name in names
            ]

        if not self.domain_intelligence:
            return [
                ProviderCheck(provider=name, status="unavailable")
                for name in names
            ]

        async def dns_and_history():
            dns = await self.domain_intelligence.lookup_dns(target.hostname)
            return dns, await self._history(target, dns)

        (dns, history), rdap = await asyncio.gather(
            dns_and_history(),
            self.domain_intelligence.lookup_rdap(domain),
        )

        return [*history, dns, rdap]

    async def _download_report(self, target: UrlTarget, dns: ProviderCheck | None) -> ProviderCheck:
        if target.scheme_assumed or not target.registered_domain:
            return ProviderCheck(provider="VirusTotal File", status="skipped",
                                 limitations=["Pemeriksaan file memerlukan URL lengkap dengan domain publik."])
        if dns is None or dns.status != "found" or dns.limitations or not any(
            detail.startswith(("A ", "AAAA ")) for detail in dns.details
        ):
            return ProviderCheck(provider="VirusTotal File", status="skipped",
                                 limitations=["DNS publik untuk alamat unduhan belum dikonfirmasi."])
        if self.urlscan is None or self.virustotal is None:
            return ProviderCheck(provider="VirusTotal File", status="unavailable")
        metadata = await self.urlscan.lookup_download(target)
        if metadata.status != "found":
            return ProviderCheck(provider="VirusTotal File", status=metadata.status,
                                 limitations=["Hash untuk URL unduhan yang sama tidak diperoleh dari arsip urlscan.io."])
        return await self.virustotal.lookup_file(metadata)

    async def _vtai_lookup(self, target: UrlTarget, consent: bool) -> ProviderCheck | None:
        if self.vtai is None:
            return None
        if not consent:
            return ProviderCheck(provider=VTAI_NAME, status="skipped", limitations=["Persetujuan pemeriksaan tambahan belum diberikan."])
        return await self.vtai.lookup(target)

    async def inspect(
        self,
        target: UrlTarget,
        lookup_consent: bool = False,
        enhanced_consent: bool = False,
    ) -> EngineResult:

        now = datetime.now(UTC)

        signals = local_signals(target)

        identity, reference = domain_identity(
            target,
            (*self.registry, *REFERENCES),
        )

        if identity == "confusable":
            signals.pop("mixed_script_hostname", None)

        risk_codes, structural_summary = structural_risk(set(signals), identity)
        evidence = [
            Evidence(
                code=code,
                kind="structure",
                explanation=description,
                source="Struktur URL",
                observed_at=now,
                validation="verified",
                severity="medium" if code in risk_codes else "unknown",
                limitations=[
                    "Ciri struktur ini tidak membuktikan phishing."
                ],
            )
            for code, description in signals.items()
        ]

        if reference:
            brand, domain, _, source = reference
            is_reference = identity == "reference_match"

            text = (
                f"Hostname berada di bawah referensi resmi "
                f"{brand} ({domain})."
                if is_reference
                else (
                    f"Nama pada alamat menyerupai referensi resmi "
                    f"{brand} ({domain}) tetapi domainnya berbeda."
                )
            )

            evidence.append(
                Evidence(
                    code=identity,
                    kind="identity",
                    explanation=text,
                    source=source,
                    observed_at=now,
                    validation="verified",
                    severity="medium" if identity in risk_codes else "low" if is_reference else "unknown",
                    limitations=[
                        "Hubungan nama domain tidak memverifikasi "
                        "keamanan atau pemilik halaman yang diperiksa."
                    ],
                )
            )

        provider_name = (
            self.provider.name
            if self.provider
            else SAFE_BROWSING_NAME
        )

        lookup, checks, vtai = await asyncio.gather(
            self._primary(target, lookup_consent),
            self._supplementary(target, enhanced_consent),
            self._vtai_lookup(target, enhanced_consent),
        )
        if vtai is not None:
            checks.append(vtai)
            if vtai.verdict in {"malicious", "suspicious"}:
                evidence.append(Evidence(
                    code="vtai_archive_alert", kind="historical", source=VTAI_NAME,
                    explanation="VirusTotal AI mencatat indikasi ancaman pada arsip untuk URL ini.",
                    observed_at=vtai.observed_at or now, validation="verified", severity="unknown",
                    limitations=vtai.limitations,
                ))

        file_alert = False
        clean_file_archive = False
        file_has_detections = False
        if enhanced_consent and signals.keys() & {"archive_download", "executable_download"}:
            dns = next((check for check in checks if check.provider == "DNS"), None)
            try:
                async with asyncio.timeout(5):
                    file_report = await self._download_report(target, dns)
            except TimeoutError:
                file_report = ProviderCheck(provider="VirusTotal File", status="timeout")
            checks.append(file_report)
            recent_file_report = (
                file_report.status == "found" and file_report.freshness == "recent"
                and freshness(file_report.archive_observed_at) == "recent"
            )
            clean_file_archive = (
                recent_file_report and file_report.verdict == "no_detection"
                and file_report.counts.get("harmless", 0) > 0
            )
            if file_report.status == "found" and file_report.verdict in {"malicious", "suspicious"}:
                file_has_detections = True
                file_alert = recent_file_report and file_report.counts.get("malicious", 0) >= 2
                evidence.append(Evidence(
                    code="file_archive_alert", kind="historical", source="VirusTotal File",
                    explanation="VirusTotal mencatat deteksi untuk SHA-256 file dari arsip URL unduhan yang sama.",
                    observed_at=file_report.observed_at or file_report.archive_observed_at or now,
                    validation="verified", severity="medium" if file_alert else "unknown",
                    limitations=file_report.limitations,
                ))

        clean_archive = next(
            (check for check in checks
             if check.provider in {"VirusTotal", "urlscan.io"}
             and check.status == "found" and check.specificity == "exact_url"
             and check.freshness == "recent" and check.observed_at is not None
             and check.verdict == "no_detection"),
            None,
        )

        if lookup.status == "match":
            evidence.append(
                Evidence(
                    code="threat_match",
                    kind="intelligence",
                    explanation=(
                        f"{provider_name} menemukan kecocokan "
                        "pada daftar ancaman yang diperiksa."
                    ),
                    indicator=", ".join(lookup.types),
                    source=provider_name,
                    observed_at=lookup.checked_at or now,
                    validation="verified",
                    severity="high",
                    limitations=[
                        "Cakupan dan akurasi daftar ancaman "
                        "tidak dapat dijamin."
                    ],
                )
            )

        historical_alerts = [
            check
            for check in checks
            if (
                check.specificity == "exact_url"
                and check.provider != VTAI_NAME
                and check.status == "found"
                and check.verdict in {"malicious", "suspicious"}
            )
        ]

        corroborated_history = False
        recent_alerts = [check for check in historical_alerts if check.freshness == "recent" and check.observed_at is not None]
        sources_agree = (
            {check.provider for check in recent_alerts} >= {"VirusTotal", "urlscan.io"}
            and any(check.verdict == "malicious" for check in recent_alerts)
        )

        for check in historical_alerts:
            if check.observed_at is not None:
                verified_report = (
                    check.freshness == "recent"
                    and (sources_agree or (
                        check.verdict == "malicious" and (check.provider == "urlscan.io" or (
                            check.provider == "VirusTotal" and check.counts.get("malicious", 0) >= 2
                        ))
                    ))
                )

                corroborated_history |= verified_report

                evidence.append(
                    Evidence(
                        code="historical_alert",
                        kind="historical",
                        explanation=(
                            f"{check.provider} melaporkan indikator "
                            "pada arsip untuk URL yang sama."
                        ),
                        source=check.provider,
                        observed_at=check.observed_at,
                        validation=(
                            "verified"
                            if verified_report
                            else "unverified"
                        ),
                        severity=(
                            "medium"
                            if verified_report
                            else "unknown"
                        ),
                        limitations=check.limitations,
                    )
                )

        strong = identity in {
            "misleading_subdomain",
            "confusable",
        }

        suspicious_identity = (
            reference is not None
            and identity != "reference_match"
        )

        limitations = [
            "Konten halaman website tidak diperiksa.",
            "Pencocokan identitas terbatas pada referensi resmi yang tersedia.",
        ]

        if target.scheme_assumed:
            limitations.append(
                "HTTPS dipakai sebagai asumsi untuk input tanpa skema. "
                "Protokol situs belum diperiksa."
            )

        if lookup.status == "no_match":
            limitations.append(
                "Tidak ada kecocokan pada kategori yang diperiksa. "
                "Cakupan daftar ancaman terbatas."
            )

        elif lookup.status == "not_requested":
            limitations.append("Pemeriksaan daftar ancaman tidak diminta.")
        elif lookup.status == "unsupported":
            limitations.append("Alamat ini berada di luar cakupan pemeriksaan daftar ancaman.")
        elif lookup.status != "match":
            limitations.append(
                f"Pemeriksaan ini tidak memperoleh hasil "
                f"dari daftar ancaman {provider_name}."
            )

        if lookup.status == "match" and identity == "reference_match":
            limitations.append(
                "Kecocokan identitas organisasi tidak menghapus "
                "temuan dari daftar ancaman."
            )

        if lookup.status == "no_match" and historical_alerts:
            limitations.append(
                "Daftar Google dan arsip historis memberi hasil berbeda. "
                "Waktu, sumber, dan cakupan pemeriksaannya berbeda."
            )

        if lookup.status == "match":
            status, risk, summary = (
                "completed",
                "high",
                (
                    f"Alamat cocok dengan daftar ancaman {provider_name}. "
                    "Akurasi daftar tidak dapat dijamin."
                ),
            )

        elif risk_codes:
            status, risk, summary = (
                "completed",
                "medium",
                structural_summary,
            )

        elif file_alert:
            status, risk, summary = (
                "completed", "medium",
                "Beberapa mesin VirusTotal menandai file yang tercatat untuk URL ini. Isi unduhan saat ini belum diperiksa.",
            )

        elif corroborated_history:
            status, risk, summary = (
                "completed",
                "medium",
                (
                    ("VirusTotal dan urlscan.io sama-sama mencatat indikasi ancaman pada arsip terbaru untuk URL yang sama. "
                     if sources_agree else "Arsip pemindaian terbaru menandai URL yang sama. ")
                    +
                    "Status website saat ini belum terverifikasi."
                ),
            )

        elif ((identity == "reference_match" or clean_archive is not None or clean_file_archive) and lookup.status == "no_match"
              and not (signals.keys() - CONTEXT_ONLY) and not historical_alerts and not file_has_detections
              and not (vtai and vtai.verdict in {"malicious", "suspicious"})):
            reason = "Domain cocok dengan referensi resmi AWASIN."
            if clean_file_archive:
                reason = ("VirusTotal tidak mencatat deteksi untuk SHA-256 dari arsip terbaru URL ini. "
                          "Isi unduhan saat ini bisa berbeda dari file yang tercatat.")
            elif identity != "reference_match" and clean_archive is not None:
                reason = f"Arsip terbaru {clean_archive.provider} untuk URL yang sama tidak mencatat deteksi."
            evidence.append(Evidence(
                code="threat_no_match",
                kind="intelligence",
                explanation=f"{provider_name} tidak menemukan kecocokan dalam daftar yang diperiksa.",
                source=provider_name,
                observed_at=lookup.checked_at or now,
                validation="verified",
                severity="low",
            ))
            status, risk, summary = (
                "completed", "low",
                f"{reason} Daftar ancaman {provider_name} juga tidak menemukan kecocokan.",
            )

        elif file_has_detections:
            status, risk, summary = (
                "partial", "unknown",
                "VirusTotal mencatat deteksi pada file yang pernah diunduh dari URL ini. Kekuatan atau usia laporan belum cukup untuk menilai unduhan saat ini.",
            )

        elif historical_alerts or (vtai and vtai.verdict in {"malicious", "suspicious"}):
            status, risk, summary = (
                "partial", "unknown",
                "Arsip untuk URL yang sama mencatat indikasi ancaman. Kekuatan atau usia buktinya belum cukup untuk menetapkan risiko saat ini.",
            )

        elif signals.keys() - CONTEXT_ONLY or suspicious_identity:
            status, risk, summary = (
                "partial",
                "unknown",
                (
                    "Ada indikator pada alamat yang layak ditinjau. "
                    "Bukti belum cukup untuk menilai tingkat risiko."
                ),
            )

        elif lookup.status == "no_match" and not signals.keys() & {"archive_download", "executable_download"}:
            status, risk, summary = (
                "inconclusive", "unknown",
                f"{provider_name} tidak menemukan kecocokan. Belum ada referensi domain atau arsip terbaru untuk URL ini yang mendukung penilaian risiko rendah.",
            )

        elif signals:
            status, risk, summary = (
                "inconclusive",
                "unknown",
                (
                    "Alamat memuat nama file arsip. Isi file belum diperiksa dan bukti belum cukup untuk menilai risikonya."
                    if "archive_download" in signals else
                    "Detail struktur alamat tersedia. Bukti belum cukup untuk menilai risiko."
                ),
            )

        else:
            status, risk, summary = (
                "inconclusive",
                "unknown",
                (
                    "Tidak ditemukan indikator ancaman dari pemeriksaan "
                    "yang berhasil dilakukan. "
                    "Hasil ini tidak menjamin website aman."
                ),
            )

        recommendations = ["Buka layanan dari kanal resmi yang kamu peroleh secara terpisah."]
        if risk == "high":
            recommendations.insert(0, "Jangan buka tautan ini.")
        if signals.keys() & {"archive_download", "executable_download"}:
            recommendations.append("Verifikasi sumber unduhan sebelum menyimpan atau membuka file.")
        elif risk != "low":
            recommendations.append("Tunda memasukkan kata sandi, OTP, atau data pribadi sampai tujuan tautan terverifikasi.")
        address = urlsplit(target.normalized_url)

        return EngineResult(
            status=status,
            risk=risk,
            explanation=summary,
            evidence=evidence,
            limitations=limitations,
            provenance=Provenance(
                engine="AWASIN URL Inspector",
                version=VERSION,
                source_type="url_structure_and_identity",
                checked_at=now,
            ),
            url_report=UrlReport(
                display_url=f"{address.scheme}://{address.netloc}",
                registered_domain=target.registered_domain,
                scheme_assumed=target.scheme_assumed,
                components_hidden=(
                    address.path not in {"", "/"}
                    or "?" in target.normalized_url
                ),
                threat_status=lookup.status,
                threat_checked_at=lookup.checked_at,
                threat_provider=provider_name,
                identity_status=(
                    "possible_impersonation"
                    if strong
                    else "name_similarity"
                    if suspicious_identity
                    else identity
                ),
                supplementary_checks=checks,
                registry_snapshot_used=(
                    reference is not None
                    and reference in self.registry
                ),
                recommendations=recommendations,
            ),
        )
