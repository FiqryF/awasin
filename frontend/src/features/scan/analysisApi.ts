import { ApiError, apiRequest } from '../../services/api'
import { requireSupabase } from '../auth/client'
import type { AnalysisMode } from './scanConfig'

type TextInput =
  | { mode: 'link' | 'website'; url: string; threat_lookup_consent?: boolean; enhanced_lookup_consent?: boolean; url_ai_consent?: boolean; openrouter_fallback_consent?: boolean }
  | { mode: 'message'; text: string }
  | { mode: 'qr'; payload: string }
type MediaInput =
  | { mode: 'message'; file: File; text?: string }
  | { mode: 'qr' | 'image' | 'video'; file: File }
export type AnalysisInput = (TextInput | MediaInput) & { request_id?: string; history_consent?: boolean; message_ai_consent?: boolean; message_openrouter_consent?: boolean; message_link_consent?: boolean; message_link_enhanced_consent?: boolean }

const statuses = ['completed', 'partial', 'inconclusive', 'unavailable', 'failed'] as const
const risks = ['low', 'medium', 'high', 'unknown'] as const
export const threatLabels = {
  match: 'Cocok dengan daftar ancaman', no_match: 'Tidak ditemukan dalam daftar ancaman yang diperiksa',
  unavailable: 'Provider belum tersedia', not_requested: 'Tidak diminta',
  unsupported: 'Alamat ini tidak didukung untuk lookup eksternal', timeout: 'Provider melewati batas waktu',
  rate_limited: 'Batas permintaan provider tercapai', invalid_response: 'Respons provider tidak dapat diverifikasi',
} as const
export const identityLabels = {
  reference_match: 'Cocok dengan referensi domain resmi',
  possible_impersonation: 'Ada indikasi peniruan domain',
  name_similarity: 'Ada kemiripan nama dengan referensi resmi',
  insufficient_evidence: 'Bukti identitas belum cukup',
} as const
export const checkLabels = {
  found: 'Data ditemukan', not_found: 'Data tidak ditemukan', skipped: 'Dilewati',
  unavailable: 'Provider belum tersedia', rate_limited: 'Batas permintaan tercapai',
  timeout: 'Provider melewati batas waktu', unauthorized: 'Akses provider ditolak',
  error: 'Respons provider tidak dapat diverifikasi',
} as const
export const specificityLabels = { exact_url: 'URL sama', hostname: 'Hostname sama', related_domain: 'Domain terkait', file_hash: 'SHA-256 dari arsip URL unduhan yang sama' } as const
export const verdictLabels = {
  malicious: 'Terdeteksi berbahaya di laporan', suspicious: 'Dicurigai di laporan',
  no_detection: 'Tidak ada deteksi di laporan', unknown: 'Verdict tidak tersedia',
} as const
export const freshnessLabels = { recent: 'Dalam 30 hari terakhir', stale: 'Lebih dari 30 hari', unknown: 'Usia laporan belum diketahui' } as const
const providers = ['VirusTotal', 'VirusTotal File', 'VirusTotal AI', 'urlscan.io', 'DNS', 'RDAP'] as const
export type ProviderCheck = {
  provider: typeof providers[number]; status: keyof typeof checkLabels; observed_at: string | null
  specificity: keyof typeof specificityLabels | null; verdict: keyof typeof verdictLabels | null
  freshness: keyof typeof freshnessLabels | null; counts: Partial<Record<'malicious' | 'suspicious' | 'harmless' | 'undetected', number>>
  categories: string[]; details: string[]; limitations: string[]; record_id: string | null
  archive_observed_at?: string | null
  engine_count?: number | null
}
type UrlReport = {
  display_url: string; registered_domain: string | null; scheme_assumed: boolean; components_hidden: boolean
  threat_status: keyof typeof threatLabels; threat_checked_at: string | null; threat_provider: 'Google Safe Browsing' | 'Google Web Risk'
  identity_status: keyof typeof identityLabels; recommendations: string[]
  supplementary_checks?: ProviderCheck[]; registry_snapshot_used?: boolean
}
type Risk = typeof risks[number]
type Evidence = {
  id: string; code: string; kind: string; explanation: string; indicator: string | null
  source: string; observed_at: string; severity: Risk; validation: 'verified' | 'unverified'; limitations: string[]
}
const aiStatuses = ['completed', 'not_requested', 'disabled', 'unavailable', 'rate_limited', 'timeout', 'validation_failed'] as const
type HistoryStatus = 'saved' | 'disabled' | 'unconfigured' | 'unavailable'
export const ocrLabels = {
  not_requested: 'OCR tidak digunakan', completed: 'Teks screenshot terbaca',
  low_confidence: 'Pembacaan OCR kurang jelas. Periksa screenshot dan coba mode teks.',
  truncated: 'Teks OCR terpotong. Gunakan screenshot yang lebih pendek atau lengkapi teks sebelum memeriksa ulang.',
  empty: 'Tidak ada teks yang cukup terbaca.', timeout: 'OCR melewati batas waktu.',
  unavailable: 'Tesseract belum tersedia di server.', missing_languages: 'Data bahasa Indonesia atau Inggris belum terpasang.',
  failed: 'Screenshot tidak dapat diproses.', busy: 'OCR sedang sibuk. Coba lagi.',
} as const
export type MessageReport = {
  ocr_status: keyof typeof ocrLabels
  ai_status: typeof aiStatuses[number] | 'invalid_response'
  analyst?: 'mistral' | 'nemotron' | null
  fallback_status?: 'unavailable' | 'rate_limited' | 'timeout' | 'invalid_response' | null
  links: { host: string; status: keyof typeof threatLabels | 'ambiguous'; risk?: Risk }[]
  recommendations: string[]
  ocr_preview?: string | null
}
type AIOffer = { status: 'pending'; ticket: string } | { status: 'disabled' | 'unavailable' | 'rate_limited' }
export type AIResult = {
  history_status?: HistoryStatus | null
  status: typeof aiStatuses[number]
  risk?: Risk
  needs_verification?: boolean
  analyst?: 'mistral' | 'nemotron'
  fallback_status?: 'unavailable' | 'rate_limited' | 'timeout' | 'validation_failed' | null
  summary: string | null
  findings: { evidence_ids: string[]; source: string; explanation: string }[]
  limitations: string[]
  recommendations: string[]
}
export type AIState = AIResult | { status: 'loading' } | { status: 'disabled' | 'unavailable' | 'rate_limited' | 'timeout' }
const detectorStatuses = ['completed', 'disabled', 'unavailable', 'rate_limited', 'timeout', 'validation_failed'] as const
export type DetectorResult = {
  status: typeof detectorStatuses[number]
  findings: { assessment: 'observed' | 'suspected'; description: string; feature_ids: string[] }[]
  verdict?: 'likely_legitimate' | 'suspicious' | 'malicious' | 'unknown' | null
  summary?: string | null
  evidence_ids?: string[]
}
export type AnalysisResult = {
  analysis_id: string; request_id: string; mode: AnalysisMode; status: typeof statuses[number]
  risk: Risk; checked_at: string; explanation: string; evidence: Evidence[]
  provenance: { engine: string; version: string; source_type: string; checked_at: string; dataset_version: string | null } | null
  processing: 'real' | 'not_performed' | 'unavailable' | 'failed'
  limitations: string[]; error_code: 'engine_unavailable' | 'engine_timeout' | 'engine_failed' | null
  media: { content_type: string; size_bytes: number; width: number | null; height: number | null } | null
  history_eligible: false
  history_status?: HistoryStatus | null
  url_report?: UrlReport | null
  message_report?: MessageReport | null
  ai?: AIOffer | null
  detector?: DetectorResult | null
  detector_offer?: AIOffer | null
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function validProviderCheck(check: ProviderCheck) {
  return check && providers.includes(check.provider) && Object.hasOwn(checkLabels, check.status) &&
    (check.observed_at === null || (typeof check.observed_at === 'string' && Number.isFinite(Date.parse(check.observed_at)))) &&
    (check.archive_observed_at == null || (typeof check.archive_observed_at === 'string' && Number.isFinite(Date.parse(check.archive_observed_at)))) &&
    (check.engine_count == null || (Number.isInteger(check.engine_count) && check.engine_count >= 0 && check.engine_count <= 10000)) &&
    (check.specificity === null || Object.hasOwn(specificityLabels, check.specificity)) &&
    (check.verdict === null || Object.hasOwn(verdictLabels, check.verdict)) &&
    (check.freshness === null || Object.hasOwn(freshnessLabels, check.freshness)) &&
    (check.record_id === null || typeof check.record_id === 'string') &&
    check.counts && typeof check.counts === 'object' && !Array.isArray(check.counts) &&
    Object.values(check.counts).every(count => Number.isInteger(count) && count >= 0) &&
    isTextList(check.categories) && isTextList(check.details) && isTextList(check.limitations)
}

function parseResult(value: unknown, mode: AnalysisMode): AnalysisResult {
  if (typeof value !== 'object' || value === null) throw new Error('Respons pemeriksaan tidak valid.')
  const result = value as Partial<AnalysisResult>
  if (
    result.mode !== mode || typeof result.analysis_id !== 'string' || typeof result.request_id !== 'string' ||
    !result.status || !statuses.includes(result.status) || !result.risk || !risks.includes(result.risk) ||
    typeof result.explanation !== 'string' || result.history_eligible !== false ||
    !Array.isArray(result.limitations) || !result.limitations.every(item => typeof item === 'string') ||
    !Array.isArray(result.evidence) || !result.evidence.every(item =>
      item && typeof item.id === 'string' && typeof item.explanation === 'string' && typeof item.source === 'string')
  ) throw new Error('Respons pemeriksaan tidak valid.')
  const report = result.url_report
  const message = result.message_report
  if (message && (mode !== 'message' || !Object.hasOwn(ocrLabels, message.ocr_status) ||
    (message.ai_status !== 'invalid_response' && !aiStatuses.includes(message.ai_status)) ||
    (message.analyst != null && (message.ai_status !== 'completed' || !['mistral', 'nemotron'].includes(message.analyst))) ||
    (message.fallback_status != null && !['unavailable', 'rate_limited', 'timeout', 'invalid_response'].includes(message.fallback_status)) ||
    !isTextList(message.recommendations) || (message.ocr_preview != null && (typeof message.ocr_preview !== 'string' || message.ocr_preview.length > 10000)) || !Array.isArray(message.links) || message.links.length > 3 ||
    !message.links.every(link => link && typeof link.host === 'string' &&
      (link.risk === undefined || risks.includes(link.risk)) &&
      (link.status === 'ambiguous' || Object.hasOwn(threatLabels, link.status))))) throw new Error('Respons pemeriksaan tidak valid.')
  if (report && (
    typeof report.display_url !== 'string' ||
    (report.registered_domain !== null && typeof report.registered_domain !== 'string') ||
    typeof report.scheme_assumed !== 'boolean' || typeof report.components_hidden !== 'boolean' ||
    !['Google Safe Browsing', 'Google Web Risk'].includes(report.threat_provider) || !Object.hasOwn(threatLabels, report.threat_status) ||
    !Object.hasOwn(identityLabels, report.identity_status) ||
    (report.supplementary_checks !== undefined && (!Array.isArray(report.supplementary_checks) ||
      !report.supplementary_checks.every(validProviderCheck))) ||
    (report.registry_snapshot_used !== undefined && typeof report.registry_snapshot_used !== 'boolean') ||
    (report.threat_checked_at !== null && (typeof report.threat_checked_at !== 'string' || !Number.isFinite(Date.parse(report.threat_checked_at)))) ||
    !Array.isArray(report.recommendations) || !report.recommendations.every(item => typeof item === 'string') ||
    !result.evidence.every(item => typeof item.kind === 'string' && typeof item.code === 'string' &&
      (item.indicator === null || typeof item.indicator === 'string') &&
      Array.isArray(item.limitations) && item.limitations.every(note => typeof note === 'string'))
  )) throw new Error('Respons pemeriksaan tidak valid.')
  for (const key of ['ai', 'detector_offer'] as const) {
    const offer = result[key]
    if (offer && !(offer.status === 'pending' ? /^[A-Za-z0-9_-]{43}$/.test(offer.ticket)
      : ['disabled', 'unavailable', 'rate_limited'].includes(offer.status))) result[key] = null
  }
  if (result.detector) result.detector = parseDetector(result.detector)
  return result as AnalysisResult
}

function parseDetector(result: DetectorResult | null): DetectorResult {
    if (!result) return { status: 'validation_failed', findings: [] }
    const { status, findings, verdict, summary, evidence_ids: refs } = result
    if (!detectorStatuses.includes(status) || !Array.isArray(findings) || findings.length > 5 ||
        !findings.every(item => item && ['observed', 'suspected'].includes(item.assessment) &&
          typeof item.description === 'string' && isTextList(item.feature_ids) &&
          item.feature_ids.every(id => /^UF-\d{2}$/.test(id))) ||
        (verdict != null && (!['likely_legitimate', 'suspicious', 'malicious', 'unknown'].includes(verdict) ||
          typeof summary !== 'string' || !isTextList(refs) || !refs.every(id => /^(UF-\d{2}|EV-\d{3})$/.test(id))))) {
      return { status: 'validation_failed', findings: [] }
    }
    return result
}

async function analysisHeaders(signal: AbortSignal, ownerId?: string) {
  const headers = new Headers()
  if (ownerId) {
    const { data, error } = await requireSupabase().auth.getSession()
    if (error || data.session?.user.id !== ownerId) throw new ApiError(401)
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }
  signal.throwIfAborted()
  return headers
}

export async function requestAnalysis(input: AnalysisInput, signal: AbortSignal, ownerId?: string) {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  const headers = await analysisHeaders(requestSignal, ownerId)
  let body: BodyInit
  let path: `/${string}` = '/api/v1/analysis'
  if ('file' in input) {
    const { file, ...metadata } = input
    const form = new FormData()
    form.set('metadata', JSON.stringify(metadata))
    form.set('file', file, 'upload')
    body = form
    path = `/api/v1/analysis/media/${input.mode}`
  } else {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(input)
  }
  const response = await apiRequest<unknown>(path, {
    method: 'POST', body, headers, signal: requestSignal, cache: 'no-store', credentials: 'omit',
  })
  return parseResult(response, input.mode)
}

export async function requestAIExplanation(ticket: string, signal: AbortSignal, ownerId?: string): Promise<AIResult> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)])
  const headers = await analysisHeaders(requestSignal, ownerId)
  headers.set('Content-Type', 'application/json')
  const result = await apiRequest<AIResult>('/api/v1/analysis/explanation', {
    method: 'POST', body: JSON.stringify({ ticket, consent: true }),
    headers, signal: requestSignal, cache: 'no-store', credentials: 'omit',
  })
  if (!result || !aiStatuses.includes(result.status)) throw new Error('Respons penjelasan tidak valid.')
  if (result.fallback_status != null && !['unavailable', 'rate_limited', 'timeout', 'validation_failed'].includes(result.fallback_status)) {
    throw new Error('Status analis cadangan tidak valid.')
  }
  if (result.status === 'completed' && (
    (result.risk !== undefined && !risks.includes(result.risk)) ||
    (result.needs_verification !== undefined && typeof result.needs_verification !== 'boolean') ||
    (result.analyst !== undefined && !['mistral', 'nemotron'].includes(result.analyst)) ||
    typeof result.summary !== 'string' || !isTextList(result.limitations) || !isTextList(result.recommendations) ||
    !Array.isArray(result.findings) || !result.findings.every(item => item && typeof item.source === 'string' &&
      typeof item.explanation === 'string' && isTextList(item.evidence_ids) &&
      item.evidence_ids.every(id => /^EV-\d{3}$/.test(id)))
  )) throw new Error('Respons penjelasan tidak valid.')
  return result
}

export async function requestDetector(ticket: string, signal: AbortSignal, ownerId?: string) {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(12_000)])
  const headers = await analysisHeaders(requestSignal, ownerId)
  headers.set('Content-Type', 'application/json')
  const result = await apiRequest<DetectorResult>('/api/v1/analysis/detector', {
    method: 'POST', body: JSON.stringify({ ticket, consent: true }),
    headers, signal: requestSignal, cache: 'no-store', credentials: 'omit',
  })
  return parseDetector(result)
}

export function analysisErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Sesi berakhir. Silakan masuk kembali.'
    if (error.status === 413) return 'Ukuran input melebihi batas pemeriksaan.'
    if (error.status === 415 || error.status === 422) return 'Input ditolak. Periksa alamat, teks, atau isi dan format file.'
    if (error.status === 429) return 'Layanan pemeriksaan sedang sibuk. Coba lagi sebentar.'
    if (error.status === 408) return 'Pengiriman melewati batas waktu. Coba lagi.'
  }
  if (error instanceof Error && error.name === 'TimeoutError') return 'Pemeriksaan melewati batas waktu. Coba lagi.'
  return 'Layanan pemeriksaan tidak dapat dihubungi. Coba lagi.'
}
