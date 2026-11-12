import { CircleAlert, Globe2, ShieldAlert, ShieldQuestion, Sparkles } from 'lucide-react'
import { checkLabels, freshnessLabels, identityLabels, specificityLabels, threatLabels, verdictLabels } from './analysisApi'
import type { AIState, AnalysisResult, ProviderCheck } from './analysisApi'

const riskLabels = {
  high: 'Ancaman ditemukan', medium: 'Ada indikasi mencurigakan', low: 'Risiko rendah', unknown: 'Belum dapat dipastikan',
} as const
const displayTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
const threatCategories: Record<string, string> = {
  SOCIAL_ENGINEERING: 'Rekayasa sosial atau phishing', MALWARE: 'Malware',
  UNWANTED_SOFTWARE: 'Perangkat lunak yang tidak diinginkan',
  POTENTIALLY_HARMFUL_APPLICATION: 'Aplikasi yang berpotensi berbahaya',
}

function CheckCard({ check }: Readonly<{ check: ProviderCheck }>) {
  const { provider, observed_at: observedAt, specificity, freshness, verdict, counts } = check
  const historical = provider === 'VirusTotal' || provider === 'urlscan.io'
  const status = historical && check.status === 'found' ? 'Laporan historis ditemukan'
    : historical && check.status === 'not_found' ? 'Laporan historis tidak ditemukan' : checkLabels[check.status]
  return (
    <div className="url-provider">
      <h5>{provider}</h5>
      <p>{status}{specificity && ` · ${specificityLabels[specificity]}`}</p>
      {observedAt && <p>{specificity ? 'Tanggal laporan' : 'Diperiksa'} <time dateTime={observedAt}>{displayTime.format(new Date(observedAt))}</time>.</p>}
      {freshness && <p>{freshnessLabels[freshness]}.</p>}
      {verdict && <p>{verdictLabels[verdict]}.</p>}
      {counts.malicious !== undefined && <p>Deteksi berbahaya {counts.malicious}</p>}
      {counts.suspicious !== undefined && <p>Deteksi mencurigakan {counts.suspicious}</p>}
      {check.categories.length > 0 && <p>Kategori {check.categories.join(', ')}</p>}
      {check.record_id && <p>ID arsip {check.record_id}</p>}
      {check.details.length > 0 && <ul>{check.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
      {check.limitations.map(note => <p key={note}>{note}</p>)}
    </div>
  )
}

const aiStatusText = {
  loading: 'Mistral sedang menyiapkan penjelasan…',
  not_requested: 'Penjelasan AI tidak diminta.',
  disabled: 'Penjelasan AI sedang dinonaktifkan.',
  unavailable: 'Penjelasan AI belum tersedia.',
  rate_limited: 'Batas permintaan penjelasan AI tercapai.',
  timeout: 'Penjelasan AI melewati batas waktu.',
  validation_failed: 'Penjelasan AI tidak lolos pemeriksaan bukti.',
} as const

function MistralExplanation({ ai }: Readonly<{ ai?: AIState | null }>) {
  if (!ai) return <p className="url-ai-optional">Penjelasan Mistral bisa diaktifkan di “Detail penggunaan data” sebelum memeriksa ulang.</p>
  return (
    <section className="url-ai-report" aria-label="Penjelasan AI">
      <header className="url-ai-heading">
        <Sparkles size={20} aria-hidden="true" />
        <div><h4>Penjelasan AI</h4><p>Dibantu Mistral AI</p></div>
      </header>
      <p role="status">{ai.status === 'completed' ? ai.summary : aiStatusText[ai.status]}</p>
      {ai.status === 'completed' && <>
        {ai.findings.length > 0 && <ul>{ai.findings.slice(0, 3).map(item => <li key={item.evidence_ids.join(',') + item.explanation}>
          {item.explanation}
        </li>)}</ul>}
        <p className="url-report-note">{ai.limitations[0] ?? 'Penjelasan mengikuti bukti yang tersedia.'}</p>
      </>}
    </section>
  )
}

const detectorStatusText = {
  disabled: 'Analisis AI karakteristik tautan sedang dinonaktifkan.',
  unavailable: 'Analisis AI karakteristik tautan belum tersedia.',
  rate_limited: 'Batas permintaan analisis AI tercapai.',
  timeout: 'Analisis AI melewati batas waktu.',
  validation_failed: 'Temuan AI tidak lolos pemeriksaan bukti.',
} as const

function DetectorReport({ detector }: Readonly<{ detector: NonNullable<AnalysisResult['detector']> }>) {
  return <section className="url-ai-report" aria-label="Analisis AI karakteristik tautan">
    <h4>Analisis AI karakteristik tautan</h4>
    {detector.status === 'completed' ? <>
      {detector.findings.length ? <ul>{detector.findings.map(item => <li key={item.feature_ids.join(',') + item.description}>
        <strong>{item.assessment === 'observed' ? 'Pola teramati' : 'Dugaan AI'}.</strong> {item.description}
      </li>)}</ul> : <p>AI tidak mengajukan temuan tambahan yang lolos pemeriksaan.</p>}
      <p className="url-report-note">Konten website belum diperiksa secara langsung.</p>
    </> : <p role="status">{detectorStatusText[detector.status]}</p>}
  </section>
}

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
    {total ? `${completed} dari ${total} sumber luar memberikan hasil.` : 'Pemeriksaan ini belum mendapat hasil dari sumber luar.'}
  </p>
}

function hostnameOf(report: UrlReport) {
  try {
    return new URL(report.display_url).hostname
  } catch {
    return report.registered_domain ?? 'Alamat tidak tersedia'
  }
}

const equivalentActions: Record<string, string> = {
  'Buka layanan dari alamat resmi yang kamu peroleh secara terpisah.': 'Buka layanan dari kanal resmi yang kamu peroleh secara terpisah.',
  'Tunda memasukkan kata sandi, OTP, atau data pribadi sampai tujuan terverifikasi.': 'Tunda memasukkan kata sandi, OTP, atau data pribadi sampai tujuan tautan terverifikasi.',
}

function actionsFor(report: UrlReport, ai?: AIState | null) {
  const choices = ai?.status === 'completed' ? ai.recommendations : []
  return [...new Set([...report.recommendations, ...choices.map(action => equivalentActions[action] ?? action)])].slice(0, 3)
}

function WebsiteFindings({ report, evidence, hostname }: Readonly<{
  report: UrlReport; evidence: AnalysisResult['evidence']; hostname: string
}>) {
  const identity = evidence.find(item => item.kind === 'identity')
  const structure = evidence.filter(item => item.kind === 'structure').slice(0, 2)
  const hasSubdomain = report.registered_domain && hostname.endsWith(`.${report.registered_domain}`)
  const archives = report.supplementary_checks?.filter(check =>
    (check.provider === 'VirusTotal' || check.provider === 'urlscan.io') && check.status === 'found')
  const historicalAlert = archives?.some(check =>
    check.specificity === 'exact_url' && (check.verdict === 'malicious' || check.verdict === 'suspicious'))
  return <section className="url-findings">
    <h4>Alasan di balik hasil ini</h4>
    <ol>
      <li>
        <strong>Domain dan identitas</strong>
        <p>{hasSubdomain && <><code>{hostname}</code> berada di bawah domain <code>{report.registered_domain}</code>. </>}
          {identity?.explanation ?? `${identityLabels[report.identity_status]}.`}</p>
      </li>
      {(report.components_hidden || structure.length > 0) && <li>
        <strong>Struktur tautan</strong>
        {structure.map(item => <p key={item.id}>{item.explanation}</p>)}
        {structure.length === 0 && <p>Alamat memiliki jalur halaman atau parameter. Pemeriksaan ini belum mengonfirmasi fungsi halaman.</p>}
      </li>}
      <li>
        <strong>Protokol</strong>
        <p>{report.scheme_assumed
          ? 'Alamat tidak menyertakan protokol. AWASIN menggunakan HTTPS sebagai asumsi.'
          : report.display_url.startsWith('https://')
            ? 'Alamat menggunakan HTTPS. Sertifikat dan koneksi ke situs belum diperiksa.'
            : 'Alamat menggunakan HTTP, yang tidak mengenkripsi koneksi.'}</p>
      </li>
      {report.threat_status !== 'not_requested' && <li>
        <strong>Daftar ancaman</strong>
        <p>{report.threat_status === 'no_match'
          ? 'Tidak ditemukan dalam daftar ancaman yang diperiksa.'
          : `${report.threat_provider} · ${threatLabels[report.threat_status]}.`}</p>
      </li>}
      {!!archives?.length && <li>
        <strong>Arsip pemindaian</strong>
        <p>{historicalAlert
          ? 'Arsip mencatat indikasi pada tautan ini. Kondisi website saat ini belum diketahui.'
          : 'Arsip berisi hasil pemeriksaan terdahulu. Kondisi website saat ini belum diketahui.'}</p>
      </li>}
    </ol>
  </section>
}

function TechnicalDetails({ report, result, ai }: Readonly<{ report: UrlReport; result: AnalysisResult; ai?: AIState | null }>) {
  return <details className="url-technical">
    <summary>Lihat detail pemeriksaan</summary>
    <div className="url-technical-body">
      <p className="url-report-note">Kelengkapan pemeriksaan menghitung sumber luar yang dicoba, termasuk sumber yang gagal atau belum tersedia. Pemeriksaan struktur dan identitas alamat dihitung terpisah.</p>
      <div>
        <h5>{report.threat_provider}</h5>
        <p>{threatLabels[report.threat_status]}.</p>
        {report.threat_checked_at && <p>Diperiksa <time dateTime={report.threat_checked_at}>{displayTime.format(new Date(report.threat_checked_at))}</time>.</p>}
      </div>
      {report.supplementary_checks?.map(check => <CheckCard key={check.provider} check={check} />)}
      <div>
        <h5>Struktur dan identitas website</h5>
        <p>{identityLabels[report.identity_status]}.</p>
        {report.scheme_assumed && <p>HTTPS digunakan sebagai asumsi karena alamat tidak menyertakan skema.</p>}
        {report.registry_snapshot_used && <p>Referensi berasal dari salinan lokal Verified Domain Registry.</p>}
        {result.provenance && <p>Sumber pemeriksaan: {result.provenance.engine} · {result.provenance.version}.</p>}
        {result.evidence.length > 0 && <ul>{result.evidence.map(item => <li key={item.id}>
          {item.explanation} <span className="url-report-note">Sumber: {item.source} · {item.id}.</span>
          {item.limitations?.length > 0 && <p>{item.limitations.join(' ')}</p>}
        </li>)}</ul>}
      </div>
      {ai?.status === 'completed' && <>
        {ai.findings.length > 0 && <div><h5>Rujukan penjelasan AI</h5><ul>{ai.findings.map(item =>
          <li key={item.evidence_ids.join(',') + item.explanation}>{item.explanation} <span className="url-report-note">{item.source} · {item.evidence_ids.join(', ')}</span></li>,
        )}</ul></div>}
        {ai.limitations.length > 0 && <div><h5>Keterbatasan AI</h5><ul>{ai.limitations.map(item => <li key={item}>{item}</li>)}</ul></div>}
      </>}
      <div><h5>Keterbatasan pemeriksaan</h5>
        <ul>{[...new Set(['Konten halaman website tidak diperiksa.', ...result.limitations])].map(item => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
  </details>
}

export function UrlAnalysisReport({ result, ai }: Readonly<{ result: AnalysisResult; ai?: AIState | null }>) {
  const report = result.url_report
  if (!report) return null
  const hostname = hostnameOf(report)
  const coverage = coverageOf(report)
  const actions = actionsFor(report, ai)
  const match = result.evidence.find(item => item.code === 'threat_match')
  const elevated = result.risk === 'high' || result.risk === 'medium'
  const RiskIcon = elevated ? ShieldAlert : ShieldQuestion
  const summary = result.risk === 'unknown' && result.status === 'inconclusive' && report.threat_status === 'no_match'
    ? 'Pemeriksaan yang selesai belum menemukan indikasi ancaman. Kondisi halaman belum dapat dipastikan.'
    : result.explanation
  return (
    <section className="url-report" aria-label="Hasil Link & Website Inspector">
      <header className="url-website">
        <Globe2 size={22} aria-hidden="true" />
        <div><h4>{hostname}</h4>
          {report.registered_domain && <p>Domain terdaftar <strong>{report.registered_domain}</strong></p>}
          {result.checked_at && Number.isFinite(Date.parse(result.checked_at)) &&
            <p>Diperiksa <time dateTime={result.checked_at}>{displayTime.format(new Date(result.checked_at))}</time></p>}
        </div>
      </header>
      <div className="url-result-card" data-risk={result.risk}>
        <div className="url-risk">
          <RiskIcon size={24} aria-hidden="true" />
          <div role="status">
            <h4>{riskLabels[result.risk]}</h4>
            <p>{summary}</p>
            {report.threat_status === 'match' && match?.indicator &&
              <p className="url-threat-category"><CircleAlert size={16} aria-hidden="true" />{match.indicator.split(', ').map(code => threatCategories[code] ?? code).join(', ')}</p>}
          </div>
        </div>
        <InspectionCoverage {...coverage} />
      </div>
      <WebsiteFindings report={report} evidence={result.evidence} hostname={hostname} />
      <MistralExplanation ai={ai} />
      {actions.length > 0 && <section className="url-actions">
        <h4>Apa yang sebaiknya kamu lakukan?</h4>
        <ul>{actions.map(item => <li key={item}>{item}</li>)}</ul>
      </section>}
      <TechnicalDetails report={report} result={result} ai={ai} />
      {result.detector && <DetectorReport detector={result.detector} />}
    </section>
  )
}
