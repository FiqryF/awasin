import type { SupabaseClient } from '@supabase/supabase-js'
import { passwordError } from './policy'
import { isValidEmail } from '../../utils/isValidEmail'
import { clearPasswordSetup } from './passwordSetup'
import { clearSessionNotice, setSessionNotice } from './sessionActivity'

export const loginFailure = 'Tidak dapat masuk. Periksa email dan kata sandi Anda.'
export class PasswordAlreadySetError extends Error {}

export function createAuthActions(client: SupabaseClient, origin: string) {
  const callback = (path: string) => new URL(path, origin).href
  return {
    async register(email: string, password: string, confirm: string, name: string) {
      if (!isValidEmail(email.trim()) || passwordError(password) || password !== confirm || !name.trim() || name.trim().length > 100) {
        throw new Error('Periksa data pendaftaran dan konfirmasi kata sandi.')
      }
      const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } })
      // A provider session is necessary; protected access still requires backend identity validation.
      if (error || !data.session?.access_token || !data.user?.id || data.user.is_anonymous || data.session.user?.id !== data.user.id) {
        throw new Error('Pendaftaran belum dapat diselesaikan. Coba masuk dengan akun Anda atau coba lagi nanti.')
      }
      clearSessionNotice()
      return data.session
    },
    async login(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error && (error.status === 0 || error.name === 'AuthRetryableFetchError')) throw new Error('Layanan login tidak dapat dihubungi. Periksa koneksi lalu coba lagi; tidak perlu mereset kata sandi.')
      if (error || !data.session || !data.user.email_confirmed_at) throw new Error(loginFailure)
      clearSessionNotice()
      return data.session
    },
    async forgot(email: string) {
      if (!isValidEmail(email.trim())) throw new Error('Format email tidak valid.')
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback('/reset-password') })
      if (error) throw new Error('Permintaan belum dapat diproses. Coba lagi nanti.')
      clearPasswordSetup()
      return 'Jika alamat memenuhi syarat, email pemulihan dikirim. Gunakan kode dari email terbaru; periksa juga Spam.'
    },
    async logout() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) {
        // Current SDK can remove the local session even when remote revocation fails.
        const remaining = await client.auth.getSession()
        if (remaining.error || remaining.data.session) throw new Error('Keluar belum berhasil. Coba lagi sebelum meninggalkan perangkat ini.')
        setSessionNotice('local-only')
      }
      clearPasswordSetup()
    },
    async updatePassword(password: string, confirm: string, nonce?: string) {
      const invalid = passwordError(password)
      if (invalid || password !== confirm) throw new Error(invalid ?? 'Konfirmasi kata sandi tidak cocok.')
      const { error } = await client.auth.updateUser({ password, ...(nonce ? { nonce } : {}) })
      if (error) {
        if (error.code === 'same_password') throw new PasswordAlreadySetError('Kata sandi ini sudah menjadi kata sandi akun Anda. Silakan kembali ke halaman masuk dan gunakan kata sandi tersebut.')
        if (error.code === 'weak_password') throw new Error('Kata sandi ditolak oleh kebijakan keamanan. Gunakan kata sandi lain yang lebih kuat.')
        if (['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error.code ?? '')) throw new Error('Sesi pemulihan sudah berakhir. Minta kode pemulihan baru.')
        if (['reauthentication_needed', 'reauthentication_not_valid'].includes(error.code ?? '')) throw new Error('Supabase meminta verifikasi ulang. Minta kode pemulihan baru sebelum menyimpan.')
        throw new Error(`Penyimpanan ditolak oleh layanan akun (${error.code ?? 'layanan_tidak_tersedia'}). Kata sandi belum dikonfirmasi berubah.`)
      }
    },
  }
}
