import re
from datetime import UTC, datetime

from app.modules.analysis.orchestrator import AnalysisInput
from app.modules.analysis.schemas import EngineResult, Evidence, Provenance


VERSION = "1.0"
URI_SCHEME = re.compile(r"^([a-z][a-z0-9+.-]{0,31}):", re.IGNORECASE)


def payload_kind(payload: str) -> tuple[str, str]:
    value = payload.strip()
    if value.upper().startswith("WIFI:"):
        return (
            "wifi_configuration",
            "QR berisi konfigurasi Wi-Fi. AWASIN tidak memeriksa keamanan jaringan atau mengungkap kata sandi dalam hasil.",
        )
    if value.upper().startswith(("BEGIN:VCARD", "MECARD:")):
        return (
            "contact_card",
            "QR berisi format kartu kontak. Periksa penerima dan data yang akan disimpan sebelum mengimpor kontak.",
        )
    if value.lower().startswith("mailto:"):
        return (
            "email_action",
            "QR berisi tindakan email. Tinjau alamat penerima dan isi pesan sebelum membuka aplikasi email.",
        )
    if value.lower().startswith("tel:"):
        return (
            "phone_action",
            "QR berisi tindakan telepon. Pastikan nomor tujuan tepercaya sebelum melakukan panggilan.",
        )
    scheme = URI_SCHEME.match(value)
    if scheme:
        return (
            "non_http_action",
            f"QR memakai skema {scheme.group(1).lower()} yang bukan tautan web HTTP(S). AWASIN tidak menjalankan tindakan tersebut.",
        )
    return (
        "plain_text",
        "QR berisi teks biasa. AWASIN tidak dapat memastikan kebenaran atau keamanan isi teks dari formatnya saja.",
    )


class QrPayloadAnalyzer:
    async def analyze(self, request: AnalysisInput) -> EngineResult:
        if request.qr_payload is None:
            raise ValueError("QR payload is required")

        now = datetime.now(UTC)
        code, explanation = payload_kind(request.qr_payload)
        return EngineResult(
            status="inconclusive",
            risk="unknown",
            explanation=explanation,
            evidence=[
                Evidence(
                    code=code,
                    kind="qr_payload_format",
                    explanation=explanation,
                    source="Analisis format QR lokal AWASIN",
                    observed_at=now,
                    validation="unverified",
                    limitations=[
                        "Klasifikasi format tidak membuktikan bahwa isi QR aman atau berbahaya.",
                    ],
                )
            ],
            provenance=Provenance(
                engine="AWASIN QR Payload Analyzer",
                version=VERSION,
                source_type="local_rules",
                checked_at=now,
            ),
            limitations=[
                "Payload diproses sementara tanpa penyimpanan atau penerusan ke provider eksternal.",
                "AWASIN tidak membuka tautan, mengimpor kontak, menghubungkan Wi-Fi, atau menjalankan tindakan QR.",
            ],
        )
