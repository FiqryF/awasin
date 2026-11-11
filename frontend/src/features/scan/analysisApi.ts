import { ApiError, apiRequest } from '../../services/api'
import { requireSupabase } from '../auth/client'
import type { ScanType } from './scanConfig'

type TextInput =
  | { mode: 'link' | 'website'; url: string }
  | { mode: 'message'; text: string }
  | { mode: 'qr'; payload: string }
type MediaInput =
  | { mode: 'message'; file: File; text?: string }
  | { mode: 'qr' | 'image' | 'video'; file: File }
export type AnalysisInput = (TextInput | MediaInput) & { request_id?: string; history_consent?: boolean }

const statuses = ['completed', 'partial', 'inconclusive', 'unavailable', 'failed'] as const
const risks = ['low', 'medium', 'high', 'unknown'] as const
type Risk = typeof risks[number]
type Evidence = {
  id: string; code: string; kind: string; explanation: string; indicator: string | null
  source: string; observed_at: string; severity: Risk; validation: 'verified' | 'unverified'; limitations: string[]
}
export type AnalysisResult = {
  analysis_id: string; request_id: string; mode: ScanType; status: typeof statuses[number]
  risk: Risk; checked_at: string; explanation: string; evidence: Evidence[]
  provenance: { engine: string; version: string; source_type: string; checked_at: string; dataset_version: string | null } | null
  processing: 'real' | 'not_performed' | 'unavailable' | 'failed'
  limitations: string[]; error_code: 'engine_unavailable' | 'engine_timeout' | 'engine_failed' | null
  media: { content_type: string; size_bytes: number; width: number | null; height: number | null } | null
  history_eligible: false
}

function parseResult(value: unknown, mode: ScanType): AnalysisResult {
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
  return result as AnalysisResult
}

export async function requestAnalysis(input: AnalysisInput, signal: AbortSignal, ownerId?: string) {
  const headers = new Headers()
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  if (ownerId) {
    const { data, error } = await requireSupabase().auth.getSession()
    if (error || data.session?.user.id !== ownerId) throw new ApiError(401)
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }
  requestSignal.throwIfAborted()
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
