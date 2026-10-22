import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { PasswordField } from '../../components/auth/PasswordField'
import { AuthFeedback } from '../../components/auth/AuthFeedback'

function ResetIdentity() {
  return (
    <div className="auth-identity-copy">
      <p className="auth-identity-tagline section-label">Kata Sandi Baru.</p>
      <h1 className="auth-identity-headline">
        Buat kata sandi<br />
        <span className="auth-identity-accent">yang kuat.</span>
      </h1>
      <p className="auth-identity-desc">
        Pilih kata sandi yang unik dan belum pernah kamu pakai sebelumnya
        untuk menjaga akun tetap aman.
      </p>
    </div>
  )
}

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!password) errs.password = 'Kata sandi baru wajib diisi.'
    else if (password.length < 8) errs.password = 'Kata sandi minimal 8 karakter.'
    if (!confirm) errs.confirm = 'Konfirmasi kata sandi wajib diisi.'
    else if (confirm !== password) errs.confirm = 'Kata sandi tidak cocok.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setLoading(true)
    setTimeout(() => setLoading(false), 800)
  }

  return (
    <AuthLayout panelContent={<ResetIdentity />}>
      <div className="auth-card">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Buat Kata Sandi Baru</h2>
          <p className="auth-card-subtitle">
            Kata sandi baru kamu akan langsung aktif setelah disimpan.
          </p>
        </div>

        <AuthFeedback type="dev">
          Fitur ini memerlukan token pemulihan dari Supabase Auth — belum tersedia.
        </AuthFeedback>

        <form onSubmit={handleSubmit} noValidate className="auth-form" aria-label="Form reset kata sandi">
          <PasswordField
            id="reset-password"
            label="Kata Sandi Baru"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="Minimal 8 karakter."
            error={errors.password}
          />
          <PasswordField
            id="reset-confirm"
            label="Konfirmasi Kata Sandi"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            error={errors.confirm}
          />

          <button type="submit" className="button button-red auth-submit" disabled={loading} aria-busy={loading}>
            {loading ? 'Menyimpan…' : 'Simpan Kata Sandi'}
            {!loading && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/login" className="auth-link">
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
