import { requireSupabase } from '../auth/client'
import { API_BASE_URL } from '../../services/api'

export type Preferences = { history_retention: 'manual' | 'disabled'; animation: 'system' | 'reduced' }
function responseError(path: string, status: number) {
  if (path === '/account/me') {
    if (status === 403) return 'Verifikasi gagal. Periksa kata sandi dan pastikan verifikasi dua langkah sudah selesai jika aktif.'
    if (status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
  }
  if (path.startsWith('/admin/')) {
    if (status === 409) return 'Data sudah ada atau berubah sejak dibuka. Muat ulang sebelum menyimpan lagi.'
    if (status === 422) return 'Periksa format, panjang isian, bukti, dan transisi status. Perubahan belum tersimpan.'
  }
  if (status === 401) return 'Sesi berakhir. Silakan masuk kembali.'
  if (status === 413) return path === '/account/export'
    ? 'Ekspor melebihi batas 500 laporan atau 500 masukan. Ekspor tidak dibuat; hubungi pengelola untuk ekspor berukuran besar.'
    : 'Ukuran permintaan terlalu besar. Kurangi isian lalu coba lagi.'
  return 'Perubahan belum dapat diproses. Layanan mungkin sedang tidak tersedia.'
}
export async function accountRequest(path: string, method = 'GET', payload?: unknown, signal?: AbortSignal, owner?: string): Promise<unknown> {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error || !data.session) throw new Error('Sesi berakhir. Silakan masuk kembali.')
  if(owner&&data.session.user.id!==owner)throw new Error('Akun aktif telah berubah. Muat ulang halaman sebelum melanjutkan.')
  const timeout = AbortSignal.timeout(path === '/account/me' ? 40000 : 15000)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, { method, cache: 'no-store', credentials: 'omit',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { Authorization: `Bearer ${data.session.access_token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}) })
  } catch { throw new Error('Layanan akun tidak dapat dihubungi. Periksa koneksi dan coba lagi.') }
  if (!response.ok) throw new Error(responseError(path, response.status))
  return response.json()
}
export function parsePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object' || !('history_retention' in value) || !('animation' in value)) {
    throw new Error('Respons preferensi tidak valid.')
  }
  const { history_retention, animation } = value
  if ((history_retention !== 'manual' && history_retention !== 'disabled') || (animation !== 'system' && animation !== 'reduced')) {
    throw new Error('Respons preferensi tidak valid.')
  }
  return { history_retention, animation }
}
export async function getPreferences(signal?: AbortSignal, owner?: string) { return parsePreferences(await accountRequest('/account/preferences', 'GET', undefined, signal, owner)) }
export async function savePreferences(value: Preferences, owner?: string) { return parsePreferences(await accountRequest('/account/preferences', 'PATCH', value, undefined, owner)) }

export async function accountExport(owner: string, signal: AbortSignal): Promise<Blob> {
  const value = await accountRequest('/account/export', 'GET', undefined, signal, owner)
  const { data, error } = await requireSupabase().auth.getSession()
  if (signal.aborted || error || data.session?.user.id !== owner) throw new Error('Akun aktif telah berubah. Ekspor dibatalkan.')
  if (!value || typeof value !== 'object' || !('format_version' in value) || value.format_version !== 2
      || !('profile' in value) || !value.profile || typeof value.profile !== 'object'
      || !('id' in value.profile) || value.profile.id !== owner) throw new Error('Respons ekspor tidak valid.')
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
}
