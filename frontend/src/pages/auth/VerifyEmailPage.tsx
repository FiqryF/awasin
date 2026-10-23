import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { completeCallback } from '../../features/auth/callback'
import { accountNotice } from '../../features/auth/actions'
import { Mail, ArrowRight } from 'lucide-react'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { AuthFeedback } from '../../components/auth/AuthFeedback'

function VerifyIdentity() {
  return (
    <div className="auth-identity-copy">
      <p className="auth-identity-tagline section-label">Hampir Selesai.</p>
      <h1 className="auth-identity-headline">
        Verifikasi<br />
        <span className="auth-identity-accent">alamat emailmu.</span>
      </h1>
      <p className="auth-identity-desc">
        Satu langkah lagi untuk mengaktifkan akun dan mulai menggunakan
        semua fitur AWASIN.
      </p>
    </div>
  )
}

export function VerifyEmailPage() {
  const [message, setMessage] = useState(accountNotice)
  const [failed, setFailed] = useState(false)
  const [callbackRequested] = useState(() => typeof window !== 'undefined' && Boolean(window.location.search || window.location.hash))
  useEffect(() => {
    if (!callbackRequested) return
    let active = true
    void completeCallback().then((kind) => {
      if (active) setMessage(kind === 'signup' ? 'Email berhasil diverifikasi. Silakan masuk untuk melanjutkan.' : 'Tautan pemulihan harus dibuka melalui halaman reset kata sandi.')
    }).catch((error: unknown) => { if (active) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Verifikasi gagal.') } })
    return () => { active = false }
  }, [callbackRequested])
  return (
    <AuthLayout panelContent={<VerifyIdentity />}>
      <div className="auth-card">
        <div className="auth-verify-icon" aria-hidden="true">
          <Mail size={32} />
        </div>

        <div className="auth-card-head">
          <h2 className="auth-card-title">Cek Emailmu</h2>
          <p className="auth-card-subtitle">
            Periksa email untuk melanjutkan verifikasi akun.
          </p>
        </div>

        <AuthFeedback type={failed ? 'error' : 'info'}>{message}</AuthFeedback>

        <p className="auth-verify-note">
          Tidak menerima email? Pastikan alamat yang kamu daftarkan sudah benar,
          lalu periksa folder spam.
          {/* Tombol kirim ulang hanya aktif setelah terhubung ke layanan. */}
        </p>

        <Link to="/login" className="button button-red auth-submit" style={{ marginTop: '8px' }}>
          Kembali ke Masuk
          <ArrowRight size={18} aria-hidden="true" />
        </Link>

        <p className="auth-switch">
          Email salah?{' '}
          <Link to="/register" className="auth-link auth-link-strong">
            Daftar ulang
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
