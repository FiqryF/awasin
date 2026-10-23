import type { SupabaseClient } from '@supabase/supabase-js'
import { passwordError } from './policy'
import { isValidEmail } from '../../utils/isValidEmail'
import { clearPasswordSetup } from './passwordSetup'

export const accountNotice = 'Jika alamat memenuhi syarat, tautan akan dikirim. Periksa kotak masuk atau spam.'
export const loginFailure = 'Tidak dapat masuk. Periksa email, kata sandi, dan verifikasi akun Anda.'
export class PasswordAlreadySetError extends Error {}

export function createAuthActions(client: SupabaseClient, origin: string) {
  const callback = (path: string) => new URL(path, origin).href
  return {
    async register(email: string, password: string, confirm: string, name: string) {
      if (!isValidEmail(email.trim()) || passwordError(password) || password !== confirm || !name.trim() || name.trim().length > 100) {
        throw new Error('Periksa email, nama, dan konfirmasi kata sandi 12–128 karakter.')
      }
      const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: callback('/verify-email') } })
      if (error && !['user_already_exists', 'email_exists'].includes(error.code ?? '')) throw new Error('Pendaftaran belum dapat diproses. Coba lagi nanti.')
      // Confirmation must be enabled by the project owner; never silently bypass it.
      if (data.session) {
        await client.auth.signOut({ scope: 'local' })
        throw new Error('Konfigurasi konfirmasi email perlu diperiksa pengelola.')
      }
      return accountNotice
    },
    async login(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error && (error.status === 0 || error.name === 'AuthRetryableFetchError')) throw new Error('Layanan login tidak dapat dihubungi. Periksa koneksi lalu coba lagi; tidak perlu mereset kata sandi.')
      if (error || !data.session || !data.user.email_confirmed_at) throw new Error(loginFailure)
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
      if (error) throw new Error('Keluar belum berhasil. Coba lagi sebelum meninggalkan perangkat ini.')
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
