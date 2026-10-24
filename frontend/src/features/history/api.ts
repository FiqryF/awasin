import { requireSupabase } from '../auth/client'
import { API_BASE_URL } from '../../services/api'
import { parseHistory, parseReport, validReportId } from './contracts'
import type { ScanMode } from './contracts'

export class HistoryError extends Error {
  constructor(public readonly status: number, message: string) { super(message) }
}
function responseError(status: number): HistoryError {
  const messages: Record<number, string> = {
    401: 'Sesi berakhir. Silakan masuk kembali.',
    403: 'Laporan tidak ditemukan atau tidak dapat diakses oleh akun ini.',
    404: 'Laporan tidak ditemukan atau tidak dapat diakses oleh akun ini.',
    409: 'Laporan belum memenuhi syarat penyimpanan atau penyimpanan baru dinonaktifkan dalam Privasi & Data.',
    422: 'Periksa kata kunci, filter, atau permintaan yang dikirim.',
  }
  return new HistoryError(status, messages[status] ?? 'Riwayat belum dapat dimuat. Layanan mungkin sedang tidak tersedia. Coba lagi nanti.')
}
export async function historyRequest(path: string, method = 'GET', body?: unknown, signal?: AbortSignal, owner?: string): Promise<unknown> {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error || !data.session) throw new HistoryError(401,'Sesi berakhir. Silakan masuk kembali.')
  if(owner&&data.session.user.id!==owner)throw new HistoryError(401,'Akun aktif telah berubah. Muat ulang halaman sebelum melanjutkan.')
  let response: Response
  const timeout = AbortSignal.timeout(15_000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  try { response = await fetch(`${API_BASE_URL}/api/v1/history${path}`, { method, signal: requestSignal, cache: 'no-store', credentials: 'omit', headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }) }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    throw new HistoryError(0,'Layanan riwayat tidak dapat dihubungi. Periksa koneksi lalu coba lagi.')
  }
  if (!response.ok) throw responseError(response.status)
  return response.json()
}
export type HistoryQuery = { search: string; mode: ScanMode | ''; sort: 'newest' | 'oldest'; cursor?: string; limit?: number }
export async function listHistory(query: HistoryQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ search: query.search, sort: query.sort, limit: String(query.limit ?? 20) })
  if (query.mode) params.set('mode',query.mode)
  if (query.cursor) params.set('cursor',query.cursor)
  return parseHistory(await historyRequest(`?${params}`, 'GET', undefined, signal))
}
export async function getReport(id: string, signal?: AbortSignal, preview = false) {
  if (!validReportId(id)) throw new HistoryError(404,'Laporan tidak ditemukan.')
  return parseReport(await historyRequest(`/${id}${preview?'?preview=true':''}`,'GET',undefined,signal))
}
export async function saveReport(id: string, consent: boolean) {
  if (!validReportId(id) || consent !== true) throw new HistoryError(422,'Persetujuan penyimpanan diperlukan.')
  return parseReport(await historyRequest('','POST',{ report_id: id, consent: true }))
}
export async function deleteHistory(id?: string, owner?: string) {
  if (id && !validReportId(id)) throw new HistoryError(404,'Laporan tidak ditemukan.')
  const result = await historyRequest(id ? `/${id}` : '?confirm=true','DELETE',undefined,undefined,owner)
  if (!result || typeof result !== 'object' || !('deleted' in result) || !Number.isSafeInteger(result.deleted) || Number(result.deleted)<0) throw new Error('Respons penghapusan tidak valid.')
  return Number(result.deleted)
}
