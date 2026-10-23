import { API_BASE_URL } from '../../services/api'

export type Identity = {
  id: string; email: string; role: 'user' | 'admin'; aal: 'aal1' | 'aal2';
  profile: { id: string; display_name: string };
}

export async function fetchIdentity(token: string, admin = false): Promise<Identity> {
  let response: Response
  try { response = await fetch(`${API_BASE_URL}/api/v1/${admin ? 'admin/identity' : 'auth/me'}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit',
    signal: AbortSignal.timeout(10000),
  }) } catch {
    throw new Error('Layanan akun tidak dapat dihubungi. Coba lagi setelah koneksi dan server tersedia; Anda tidak perlu mereset kata sandi.')
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sesi tidak valid. Silakan masuk kembali.')
    if (response.status === 403) throw new Error('Akses ditolak. Hak administrator diperlukan.')
    throw new Error('Verifikasi akun belum tersedia. Coba lagi nanti.')
  }
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object') throw new Error('Respons identitas tidak valid.')
  const value = data as Partial<Identity>
  if (typeof value.id !== 'string' || typeof value.email !== 'string' || !['user', 'admin'].includes(value.role ?? '') || !['aal1', 'aal2'].includes(value.aal ?? '') || value.profile?.id !== value.id || typeof value.profile?.display_name !== 'string') throw new Error('Respons identitas tidak valid.')
  return value as Identity
}
