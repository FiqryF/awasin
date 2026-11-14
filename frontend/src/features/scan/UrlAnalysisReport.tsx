import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { checkLabels, freshnessLabels, specificityLabels, threatLabels, verdictLabels } from './analysisApi'
import type { AIResult, AIState, AnalysisResult } from './analysisApi'
import { ScanResultDetails } from './ScanResultDetails'

const riskLabels = {
  high: 'Berbahaya — Risiko tinggi',
  medium: 'Waspada — Risiko sedang',
  low: 'Aman',
  unknown: 'Belum dapat dipastikan',
} as const
type UrlReport = NonNullable<AnalysisResult['url_report']>
const riskIcons = { low: ShieldCheck, medium: ShieldAlert, high: ShieldAlert, unknown: ShieldQuestion }
const historyLabels = {
  saved: 'Tersimpan di Riwayat.',
  disabled: 'Penyimpanan Riwayat dinonaktifkan di pengaturan akun.',
  unconfigured: 'Penyimpanan Riwayat belum dikonfigurasi di server.',
  unavailable: 'Hasil belum dapat disimpan ke Riwayat.',
}

function analysisNote(finalAnalysis: AIResult | null, ai?: AIState | null) {
  if (finalAnalysis) {
    const analyst = finalAnalysis.analyst === 'nemotron' ? 'Nemotron' : 'Mistral'
    return `Hasil akhir · Penilaian ${analyst} tervalidasi`
  }
  if (ai?.status === 'loading') return 'Hasil sementara · Menunggu analisis Mistral'
  if (ai?.status === 'rate_limited') return 'Hasil pemeriksaan AWASIN · Batas permintaan AI tercapai'
  return ai ? 'Hasil pemeriksaan AWASIN · Analisis AI belum menghasilkan keputusan' : 'Hasil pemeriksaan AWASIN'
}

function coverageOf(report: UrlReport) {
  const checks = report.supplementary_checks ?? []
  const applicable = checks.filter(check => check.status !== 'skipped')
  const threatApplicable = report.threat_status !== 'not_requested' && report.threat_status !== 'unsupported'
  const threatCompleted = report.threat_status === 'match' || report.threat_status === 'no_match'
  return {
    total: applicable.length + Number(threatApplicable),
    completed: applicable.filter(check => check.status === 'found' || check.status === 'not_found').length + Number(threatCompleted),
  }
}

function InspectionCoverage({ completed, total }: Readonly<ReturnType<typeof coverageOf>>) {
  return <p className="url-report-note">
    {total ? `${completed} dari ${total} pemeriksaan sumber luar selesai.` : 'Pemeriksaan ini belum mendapat hasil dari sumber luar.'}
  </p>
}

export function UrlAnalysisReport({ result, ai }: Readonly<{
  result: AnalysisResult; ai?: AIState | null
}>) {
  const report = result.url_report
  if (!report) return null
  const coverage = coverageOf(report)
  const finalAnalysis = ai?.status === 'completed' && ai.risk != null ? ai : null
  const risk = finalAnalysis?.risk ?? result.risk
  const recommendations = finalAnalysis?.recommendations.length ? finalAnalysis.recommendations : report.recommendations
  const findings = finalAnalysis?.findings.length ? finalAnalysis.findings : result.evidence
  const historyStatus = (ai && 'history_status' in ai ? ai.history_status : null) ?? result.history_status
  const RiskIcon = riskIcons[risk]
  const title = riskLabels[risk] + (risk === 'high' && report.threat_status === 'match' ? ' · Ancaman ditemukan' : '')
  const summary = (finalAnalysis?.summary ?? result.explanation).replace(' Temuan ini belum memastikan bahwa tautan tersebut merupakan penipuan.', '')
  return (
    <section className="url-report" aria-label="Hasil Link & Website Inspector">
      <div className="url-result-card" data-risk={risk}>
        <div className="url-risk">
          <RiskIcon size={24} aria-hidden="true" />
          <div>
            <h4>{title}</h4>
            <p><output>{summary}</output></p>
          </div>
        </div>
        <p className="url-report-note">{analysisNote(finalAnalysis, ai)}</p>
        <InspectionCoverage {...coverage} />
        {historyStatus && <output className="url-report-note block">{historyLabels[historyStatus]}</output>}
        <ScanResultDetails recommendations={recommendations} findings={findings}>
          <section>
            <h5>Sumber pemeriksaan</h5>
            <ul>
              <li><strong>{report.threat_provider}</strong> · {threatLabels[report.threat_status]}</li>
              {report.supplementary_checks?.map((check, index) => <li key={`${check.provider}-${index}`}>
                <strong>{check.provider}</strong> · {checkLabels[check.status]}
                {check.specificity && ` · ${specificityLabels[check.specificity]}`}
                {check.verdict && ` · ${verdictLabels[check.verdict]}`}
                {check.freshness && ` · ${freshnessLabels[check.freshness]}`}
              </li>)}
            </ul>
          </section>
        </ScanResultDetails>
      </div>
    </section>
  )
}
