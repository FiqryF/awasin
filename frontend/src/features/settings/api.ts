import { requireSupabase } from '../auth/client'
import { API_BASE_URL } from '../../services/api'

export type Preferences = { history_retention: 'manual' | 'disabled'; animation: 'system' | 'reduced' }
function responseError(path: string, status: number) {
  if (path.startsWith('/admin/')) {
    if (status === 409) return 'Data sudah ada atau berubah sejak dibuka. Muat ulang sebelum menyimpan lagi.'
    if (status === 422) return 'Periksa format, panjang isian, bukti, dan transisi status. Perubahan belum tersimpan.'
  }
  if (status === 401) return 'Sesi berakhir. Silakan masuk kembali.'
  if (status === 413) return 'Ekspor melebihi batas 500 laporan atau 500 masukan. Ekspor tidak dibuat; hubungi pengelola untuk ekspor berukuran besar.'
  return 'Perubahan belum dapat diproses. Layanan mungkin sedang tidak tersedia.'
}
export async function accountRequest(path: string, method = 'GET', payload?: unknown, signal?: AbortSignal, owner?: string): Promise<unknown> {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error || !data.session) throw new Error('Sesi berakhir. Silakan masuk kembali.')
  if(owner&&data.session.user.id!==owner)throw new Error('Akun aktif telah berubah. Muat ulang halaman sebelum melanjutkan.')
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, { method, cache: 'no-store', credentials: 'omit',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${data.session.access_token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}) })
  } catch { throw new Error('Layanan akun tidak dapat dihubungi. Periksa koneksi dan coba lagi.') }
  if (!response.ok) throw new Error(responseError(path, response.status))
  return response.json()
}
export function parsePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object' || !('history_retention' in value) || !('animation' in value) || !['manual','disabled'].includes(String(value.history_retention)) || !['system','reduced'].includes(String(value.animation))) throw new Error('Respons preferensi tidak valid.')
  return value as Preferences
}
export async function getPreferences(signal?: AbortSignal, owner?: string) { return parsePreferences(await accountRequest('/account/preferences', 'GET', undefined, signal, owner)) }
export async function savePreferences(value: Preferences, owner?: string) { return parsePreferences(await accountRequest('/account/preferences', 'PATCH', value, undefined, owner)) }
