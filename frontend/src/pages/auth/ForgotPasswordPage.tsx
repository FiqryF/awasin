import { useState, type SubmitEvent } from 'react'
import { isValidEmail } from '../../utils/isValidEmail'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { AuthFeedback } from '../../components/auth/AuthFeedback'

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

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) { setEmailError('Email wajib diisi.'); return }
    if (!isValidEmail(email)) { setEmailError('Format email tidak valid.'); return }
    setEmailError('')
    setLoading(true)
    // Supabase Auth belum disambungkan.
    setTimeout(() => setLoading(false), 800)
  }

  return (
    <AuthLayout panelContent={<ForgotIdentity />} backTo="/login" backLabel="Kembali ke halaman masuk">
      <div className="auth-card">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Lupa Kata Sandi?</h2>
          <p className="auth-card-subtitle">
            Masukkan email untuk menerima tautan pengaturan ulang sandi.
          </p>
        </div>

        <AuthFeedback type="dev">
          Pengiriman email pengaturan ulang sandi belum tersedia — Supabase Auth belum terhubung.
        </AuthFeedback>

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
            {loading ? 'Memproses…' : 'Kirim Tautan'}
          </button>
        </form>

      </div>
    </AuthLayout>
  )
}
