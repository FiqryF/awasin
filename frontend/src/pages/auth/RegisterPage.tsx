import { useState, type SubmitEvent } from 'react'
import { isValidEmail } from '../../utils/isValidEmail'
import { Link } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { PasswordField } from '../../components/auth/PasswordField'
import { AuthFeedback } from '../../components/auth/AuthFeedback'
import { LegalDialog } from '../../features/legal/LegalDialog'
import type { LegalDocumentKind } from '../../features/legal/legalContent'

// ─── Panel identitas kiri ─────────────────────────────────────────────────────
function RegisterIdentity() {
  return (
    <div className="auth-identity-copy">
      <p className="auth-identity-tagline section-label">Bergabung Sekarang.</p>
      <h1 className="auth-identity-headline">
        Lindungi diri dari<br />
        <span className="auth-identity-accent">penipuan digital.</span>
      </h1>
      <p className="auth-identity-desc">
        Buat akun gratis untuk menyimpan riwayat pemeriksaan dan mendapatkan
        laporan yang lebih lengkap.
      </p>
      <div className="auth-identity-features">
        {['Simpan riwayat pemeriksaan', 'Laporan analisis lengkap', 'Akses semua modul AWASIN'].map((f) => (
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
function validate(fullName: string, email: string, password: string, confirm: string, agreed: boolean) {
  const errs: { fullName?: string; email?: string; password?: string; confirm?: string; agreed?: string } = {}
  if (!fullName.trim()) errs.fullName = 'Nama lengkap wajib diisi.'
  if (!email.trim()) errs.email = 'Email wajib diisi.'
  else if (!isValidEmail(email)) errs.email = 'Format email tidak valid.'
  if (!password) errs.password = 'Kata sandi wajib diisi.'
  else if (password.length < 8) errs.password = 'Kata sandi minimal 8 karakter.'
  if (!confirm) errs.confirm = 'Konfirmasi kata sandi wajib diisi.'
  else if (confirm !== password) errs.confirm = 'Kata sandi tidak cocok.'
  if (!agreed) errs.agreed = 'Kamu harus menyetujui ketentuan untuk melanjutkan.'
  return errs
}

// ─── Halaman Register ─────────────────────────────────────────────────────────
export function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [legalDocument, setLegalDocument] = useState<LegalDocumentKind | null>(null)
  const [errors, setErrors] = useState<{
    fullName?: string; email?: string; password?: string; confirm?: string; agreed?: string
  }>({})
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs = validate(fullName, email, password, confirm, agreed)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    // Supabase Auth belum disambungkan — tampilkan status jujur.
    setLoading(true)
    setTimeout(() => setLoading(false), 800)
  }

  return (
    <AuthLayout panelContent={<RegisterIdentity />}>
      <div className="auth-card">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Bergabung dengan AWASIN</h2>
          <p className="auth-card-subtitle">
            Buat akun untuk menyimpan riwayat pemeriksaan sesuai pilihanmu.
          </p>
        </div>

        <AuthFeedback type="dev">
          Pendaftaran sedang dalam pengembangan — integrasi Supabase Auth belum tersedia.
        </AuthFeedback>

        <form onSubmit={handleSubmit} noValidate className="auth-form" aria-label="Form pendaftaran">
          <FormField
            id="reg-fullname"
            label="Nama Lengkap"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            placeholder="Nama kamu"
            error={errors.fullName}
          />

          <FormField
            id="reg-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="nama@email.com"
            error={errors.email}
          />

          <PasswordField
            id="reg-password"
            label="Kata Sandi"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="Minimal 8 karakter."
            error={errors.password}
          />

          <PasswordField
            id="reg-confirm"
            label="Konfirmasi Kata Sandi"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            error={errors.confirm}
          />

          {/* Checkbox persetujuan */}
          <div className="auth-agree-wrap">
            <div className="auth-agree-label">
              <input
                id="reg-agree"
                type="checkbox"
                className="auth-agree-check"
                checked={agreed}
                aria-labelledby="reg-agree-label"
                onChange={(e) => setAgreed(e.target.checked)}
                aria-describedby={errors.agreed ? 'reg-agree-error' : undefined}
              />
              <span id="reg-agree-label">
                <label htmlFor="reg-agree">Saya menyetujui</label>{' '}
                <button type="button" className="auth-link auth-legal-trigger" onClick={() => setLegalDocument('terms')} aria-haspopup="dialog">
                  Ketentuan Penggunaan
                </button>{' '}
                dan{' '}
                <button type="button" className="auth-link auth-legal-trigger" onClick={() => setLegalDocument('privacy')} aria-haspopup="dialog">
                  Kebijakan Privasi
                </button>{'.'}
              </span>
            </div>
            {errors.agreed && (
              <p id="reg-agree-error" className="auth-field-error" role="alert">
                {errors.agreed}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="button button-red auth-submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Memproses…' : 'Buat Akun'}
          </button>
        </form>

        <p className="auth-switch">
          Sudah punya akun?{' '}
          <Link to="/login" className="auth-link auth-link-strong">
            Masuk
          </Link>
        </p>
      </div>
      {legalDocument && <LegalDialog kind={legalDocument} onClose={() => setLegalDocument(null)} />}
    </AuthLayout>
  )
}
