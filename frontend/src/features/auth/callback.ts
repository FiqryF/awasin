import { requireSupabase } from './client'
import { isValidEmail } from '../../utils/isValidEmail'
import { rememberPasswordSetup } from './passwordSetup'

export async function verifyRecoveryCode(email: string, token: string): Promise<void> {
  if (!isValidEmail(email.trim()) || !/^\d{6,10}$/.test(token.trim())) throw new Error('Isi email dan kode angka dari email terbaru.')
  const { data, error } = await requireSupabase().auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'recovery' })
  if (error || !data.session || !data.user?.email_confirmed_at) throw new Error('Kode tidak valid atau sudah digunakan. Gunakan kode dari email terbaru.')
  rememberPasswordSetup(data.user.id)
}

type CallbackKind = 'recovery' | 'signup' | 'invite'
let pending: Promise<CallbackKind> | undefined
let pendingCode: string | null = null

// One exchange per page load, shared by StrictMode remounts. No access tokens in URLs.
export function completeCallback(): Promise<CallbackKind> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const invitation = params.get('token_hash')
  const callbackId = code ?? invitation
  if (pending !== undefined && (!callbackId || callbackId === pendingCode)) return pending
  pendingCode = callbackId
  const failed = params.has('error') || params.has('error_code') || Boolean(window.location.hash)
  window.history.replaceState(null, '', window.location.pathname)
  pending = (async () => {
    if (failed || (code && invitation) || !callbackId || callbackId.length > 4096) throw new Error('Tautan tidak valid atau kedaluwarsa. Minta tautan baru dari perangkat ini.')
    const { auth } = requireSupabase()
    if (invitation) {
      const type = params.get('type')
      if ((type !== 'invite' && type !== 'recovery') || window.location.pathname !== '/reset-password') throw new Error('Jenis tautan tidak diizinkan.')
      const { data, error } = await auth.verifyOtp({ token_hash: invitation, type })
      if (error || !data.session || !data.user?.email_confirmed_at) throw new Error('Tautan tidak valid atau kedaluwarsa. Minta tautan baru.')
      rememberPasswordSetup(data.user.id)
      return type
    }
    let recovery = false
    const { data: { subscription } } = auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') recovery = true })
    try {
      const { data, error } = await auth.exchangeCodeForSession(code!)
      if (error || !data.session || !data.user?.email_confirmed_at) throw new Error('Verifikasi gagal. Minta tautan baru dan buka di browser yang sama.')
      if (recovery) rememberPasswordSetup(data.user.id)
      return recovery ? 'recovery' : 'signup'
    } finally { subscription.unsubscribe() }
  })()
  return pending
}
