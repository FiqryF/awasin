import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { ocrLabels, threatLabels } from './analysisApi'
import type { AnalysisResult } from './analysisApi'

const riskLabels = { low: 'Aman', medium: 'Waspada — Risiko sedang', high: 'Berbahaya — Risiko tinggi', unknown: 'Belum dapat dipastikan' }
const aiLabels = {
  completed: 'Penilaian Mistral tervalidasi', not_requested: 'Analisis AI tidak diminta', disabled: 'Analisis AI dinonaktifkan',
  unavailable: 'Analisis AI belum tersedia', rate_limited: 'Batas permintaan AI tercapai', timeout: 'Analisis AI melewati batas waktu',
  invalid_response: 'Analisis AI tidak lolos validasi', validation_failed: 'Analisis AI tidak lolos validasi',
}

export function MessageAnalysisReport({ result, onEditText }: Readonly<{ result: AnalysisResult; onEditText: (text: string) => void }>) {
  const report = result.message_report
  if (!report) return null
  let title = riskLabels[result.risk]
  if (result.risk === 'unknown') {
    if (report.ocr_status !== 'not_requested' && report.ocr_status !== 'completed') title = 'Teks screenshot perlu diperiksa'
    else if (report.ai_status === 'completed') title = 'Bukti belum cukup'
    else if (report.ai_status === 'not_requested') title = 'Pemeriksaan tanpa AI'
    else title = 'Analisis AI gagal'
  }
  const Icon = result.risk === 'low' ? ShieldCheck : result.risk === 'unknown' ? ShieldQuestion : ShieldAlert
  const needsOcrReview = report.ocr_status === 'low_confidence' || report.ocr_status === 'truncated'
  return <section className="url-report" aria-label="Hasil analisis pesan">
    <div className="url-result-card" data-risk={result.risk} role="status">
      <div className="url-risk"><Icon size={24} aria-hidden="true" /><div><h4>{title}</h4><p>{result.explanation}</p></div></div>
      <p className="url-report-note">{report.ai_status !== 'completed' && 'Hasil pemeriksaan AWASIN · '}{report.analyst === 'nemotron' ? 'Penilaian Nemotron (OpenRouter) tervalidasi' : aiLabels[report.ai_status]}.</p>
      {report.fallback_status && <p className="url-report-note">Cadangan Nemotron (OpenRouter) · {aiLabels[report.fallback_status]}.</p>}
      {report.ocr_status !== 'not_requested' && report.ocr_status !== 'completed' && <p className="url-report-note">{ocrLabels[report.ocr_status]}</p>}
      {report.links.length > 0 && <ul className="url-report-note" aria-label="Pemeriksaan Link & Web">
        {report.links.map((link, index) => <li key={`${link.host}-${index}`}><strong>{link.host}</strong> · {link.risk && link.risk !== 'unknown'
          && `${riskLabels[link.risk]} · `}{link.status === 'ambiguous' ? 'Perlu dicek ulang dari teks asli' : threatLabels[link.status]}</li>)}
      </ul>}
      {result.history_status && <p className="url-report-note">{result.history_status === 'saved' ? 'Tersimpan di Riwayat.' : 'Ringkasan belum tersimpan di Riwayat.'}</p>}
      {needsOcrReview && report.ocr_preview && <details className="message-ocr-preview url-report-note">
        <summary>Pratinjau teks OCR yang disaring</summary>
        <pre>{report.ocr_preview}</pre>
        <button type="button" className="button button-red" onClick={() => onEditText(report.ocr_preview!)}>Koreksi di mode teks</button>
      </details>}
    </div>
  </section>
}
