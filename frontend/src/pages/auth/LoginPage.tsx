import { useState, type SubmitEvent } from 'react'
import { isValidEmail } from '../../utils/isValidEmail'
import { Link, useLocation, useNavigate } from 'react-router'
import { requireSupabase, supabase } from '../../features/auth/client'
import { createAuthActions } from '../../features/auth/actions'
import { fetchIdentity } from '../../features/auth/identity'
import { identityDestination, safeReturnPath } from '../../features/auth/policy'
import { ShieldCheck } from 'lucide-react'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { PasswordField } from '../../components/auth/PasswordField'
import { AuthFeedback } from '../../components/auth/AuthFeedback'

// ─── Panel identitas kiri ─────────────────────────────────────────────────────
function LoginIdentity() {
  return (
    <div className="auth-identity-copy">
      <p className="auth-identity-tagline section-label">Cek Dulu, Lebih Aman.</p>
      <h1 className="auth-identity-headline">
        Periksa ancaman digital dengan<br />
        <span className="auth-identity-accent">lebih cerdas.</span>
      </h1>
      <p className="auth-identity-desc">
        Akses riwayat pemeriksaan, simpan laporan, dan kelola akun AWASIN&nbsp;kamu
        setelah masuk.
      </p>
      <div className="auth-identity-features">
        {['Link Inspector', 'Message Analyzer', 'QR Security Scanner'].map((f) => (
          <div key={f} className="auth-identity-feature-item">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Validasi sederhana sisi klien ────────────────────────────────────────────
function validate(email: string, password: string) {
  const errs: { email?: string; password?: string } = {}
  if (!email.trim()) errs.email = 'Email wajib diisi.'
  else if (!isValidEmail(email)) errs.email = 'Format email tidak valid.'
  if (!password) errs.password = 'Kata sandi wajib diisi.'
  return errs
}

// ─── Halaman Login ────────────────────────────────────────────────────────────
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const { state } = useLocation()

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs = validate(email, password)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    if (loading) return
    setLoading(true)
    setMessage('')
    try {
      const session = await createAuthActions(requireSupabase(), window.location.origin).login(email, password)
      setPassword('')
      const identity = await fetchIdentity(session.access_token)
      const requested = safeReturnPath(state?.returnTo)
      let destination = '/dashboard'
      if (identity.role === 'admin') destination = identityDestination(identity)
      else if (requested && !requested.startsWith('/admin')) destination = requested
      await navigate(destination, { replace: true })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Tidak dapat masuk. Coba lagi.') }
    finally { setLoading(false) }
  }

  return (
    <AuthLayout panelContent={<LoginIdentity />}>
      <div className="auth-card">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Selamat Datang Kembali</h2>
          <p className="auth-card-subtitle">
            Masuk untuk mengakses riwayat pemeriksaan dan mengelola akun AWASIN.
          </p>
        </div>

        {(!supabase || message) && <AuthFeedback type={message ? 'error' : 'dev'}>{message || 'Layanan akun belum dikonfigurasi pada perangkat ini.'}</AuthFeedback>}

        <form onSubmit={handleSubmit} noValidate className="auth-form" aria-label="Form masuk">
          <FormField
            id="login-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="nama@email.com"
            error={errors.email}
          />

          <PasswordField
            id="login-password"
            label="Kata Sandi"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            error={errors.password}
          />

          <div className="auth-form-meta">
            <Link to="/forgot-password" className="auth-link">
              Lupa kata sandi?
            </Link>
          </div>

          <button
            type="submit"
            className="button button-red auth-submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        <p className="auth-switch">
          Belum punya akun?{' '}
          <Link to="/register" className="auth-link auth-link-strong">
            Daftar
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
