import { useState, type SubmitEvent } from 'react'
import { isValidEmail } from '../../utils/isValidEmail'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { AuthFeedback } from '../../components/auth/AuthFeedback'
import { requireSupabase, supabase } from '../../features/auth/client'
import { createAuthActions } from '../../features/auth/actions'

function ForgotIdentity() {
  return (
    <div className="auth-identity-copy">
      <p className="auth-identity-tagline section-label">Keamanan Akun.</p>
      <h1 className="auth-identity-headline">
        Atur ulang<br />
        <span className="auth-identity-accent">kata sandi kamu.</span>
      </h1>
      <p className="auth-identity-desc">
        Masukkan alamat email yang terdaftar. Kami akan memandu kamu untuk
        membuat kata sandi baru secara aman.
      </p>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  let feedbackType: 'error' | 'info' | 'dev' = 'dev'
  if (failed) feedbackType = 'error'
  else if (message) feedbackType = 'info'

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) { setEmailError('Email wajib diisi.'); return }
    if (!isValidEmail(email)) { setEmailError('Format email tidak valid.'); return }
    setEmailError('')
    if (loading) return
    setLoading(true)
    setMessage(''); setFailed(false)
    try { setMessage(await createAuthActions(requireSupabase(), window.location.origin).forgot(email)) }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Permintaan gagal. Coba lagi nanti.') }
    finally { setLoading(false) }
  }

  return (
    <AuthLayout panelContent={<ForgotIdentity />} backTo="/login" backLabel="Kembali ke halaman masuk">
      <div className="auth-card">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Lupa Kata Sandi?</h2>
          <p className="auth-card-subtitle">
            Masukkan email untuk menerima kode pemulihan kata sandi.
          </p>
        </div>

        {(!supabase || message) && <AuthFeedback type={feedbackType}>{message || 'Layanan akun belum dikonfigurasi pada perangkat ini.'}</AuthFeedback>}

        <form onSubmit={handleSubmit} noValidate className="auth-form" aria-label="Form lupa kata sandi">
          <FormField
            id="forgot-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="nama@email.com"
            error={emailError}
          />

          <button type="submit" className="button button-red auth-submit" disabled={loading} aria-busy={loading}>
            {loading ? 'Memproses…' : 'Kirim Kode Pemulihan'}
          </button>
        </form>
        {message && !failed && <p className="auth-switch"><a className="button button-red auth-submit" href="/reset-password">Masukkan kode dari email</a></p>}

      </div>
    </AuthLayout>
  )
}
