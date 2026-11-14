import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import type { AIState, AnalysisResult } from './analysisApi'

const riskLabels = {
  high: 'Berbahaya — Risiko tinggi',
  medium: 'Waspada — Risiko sedang',
  low: 'Aman',
  unknown: 'Belum dapat dipastikan',
} as const
type UrlReport = NonNullable<AnalysisResult['url_report']>

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
  const historyStatus = (ai && 'history_status' in ai ? ai.history_status : null) ?? result.history_status
  const elevated = risk === 'high' || risk === 'medium'
  const RiskIcon = elevated ? ShieldAlert : risk === 'low' ? ShieldCheck : ShieldQuestion
  return (
    <section className="url-report" aria-label="Hasil Link & Website Inspector">
      <div className="url-result-card" data-risk={risk}>
        <div className="url-risk">
          <RiskIcon size={24} aria-hidden="true" />
          <div role="status">
            <h4>{riskLabels[risk]}{risk === 'high' && report.threat_status === 'match' ? ' · Ancaman ditemukan' : ''}</h4>
            <p>{(finalAnalysis?.summary ?? result.explanation).replace(' Temuan ini belum memastikan bahwa tautan tersebut merupakan penipuan.', '')}</p>
          </div>
        </div>
        <p className="url-report-note">
          {finalAnalysis ? `Hasil akhir · Penilaian ${finalAnalysis.analyst === 'nemotron' ? 'Nemotron' : 'Mistral'} tervalidasi`
            : ai?.status === 'loading' ? 'Hasil sementara · Menunggu analisis Mistral'
              : ai?.status === 'rate_limited' ? 'Hasil pemeriksaan AWASIN · Batas permintaan AI tercapai'
                : ai ? 'Hasil pemeriksaan AWASIN · Analisis AI belum menghasilkan keputusan' : 'Hasil pemeriksaan AWASIN'}
        </p>
        <InspectionCoverage {...coverage} />
        {historyStatus && <p className="url-report-note" role="status">
          {historyStatus === 'saved' ? 'Tersimpan di Riwayat.' : historyStatus === 'disabled'
            ? 'Penyimpanan Riwayat dinonaktifkan di pengaturan akun.' : historyStatus === 'unconfigured'
              ? 'Penyimpanan Riwayat belum dikonfigurasi di server.' : 'Hasil belum dapat disimpan ke Riwayat.'}
        </p>}
      </div>
    </section>
  )
}
