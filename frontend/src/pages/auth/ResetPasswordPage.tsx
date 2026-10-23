import { useEffect, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { PasswordField } from '../../components/auth/PasswordField'
import { AuthFeedback } from '../../components/auth/AuthFeedback'
import { completeCallback, verifyRecoveryCode } from '../../features/auth/callback'
import { FormField } from '../../components/auth/FormField'
import { requireSupabase } from '../../features/auth/client'
import { createAuthActions, PasswordAlreadySetError } from '../../features/auth/actions'
import { rememberPasswordSetup, restorePasswordSetup } from '../../features/auth/passwordSetup'
import { passwordError } from '../../features/auth/policy'

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
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [hasCallback] = useState(() => Boolean(window.location.search || window.location.hash))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState(hasCallback ? 'Memeriksa tautan pemulihan…' : 'Masukkan email dan kode pemulihan dari email terbaru.')
  useEffect(() => {
    let active = true
    const restore = async () => {
      if (hasCallback) return completeCallback()
      const progress = await restorePasswordSetup()
      if (active && progress === 'completed') { setDone(true); setMessage('Kata sandi sudah disiapkan. Silakan masuk.') }
      return progress === 'ready' ? 'recovery' : null
    }
    void restore().then((kind) => {
      if (!active) return
      if (kind === null) return
      if (kind !== 'recovery' && kind !== 'invite') { setMessage('Tautan ini bukan sesi pemulihan atau undangan akun. Minta tautan baru.'); return }
      setReady(true); setMessage('Sesi pemulihan terverifikasi. Masukkan kata sandi baru.')
    }).catch((error: unknown) => { if (active) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Tautan pemulihan tidak valid.') } })
    return () => { active = false }
  }, [hasCallback])

  async function verifyCode(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true); setFailed(false)
    try {
      await verifyRecoveryCode(email, code)
      setReady(true); setCode(''); setMessage('Email terverifikasi. Silakan buat kata sandi baru.')
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Verifikasi kode gagal.') }
    finally { setLoading(false) }
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!password) errs.password = 'Kata sandi baru wajib diisi.'
    else if (passwordError(password)) errs.password = passwordError(password)!
    if (!confirm) errs.confirm = 'Konfirmasi kata sandi wajib diisi.'
    else if (confirm !== password) errs.confirm = 'Kata sandi tidak cocok.'
    setErrors(errs)
    if (Object.keys(errs).length > 0 || !ready || loading || done) return
    setLoading(true); setFailed(false)
    try {
      const client = requireSupabase()
      const { data, error } = await client.auth.getUser()
      if (error || !data.user?.email_confirmed_at) throw new Error('Sesi pemulihan berakhir. Minta kode baru.')
      const actions = createAuthActions(client, window.location.origin)
      let alreadySet = false
      try { await actions.updatePassword(password, confirm) }
      catch (error) {
        if (!(error instanceof PasswordAlreadySetError)) {
          throw error
        }
        alreadySet = true
      }
      setDone(true); setPassword(''); setConfirm('')
      const success = alreadySet ? 'Kata sandi tersebut sudah aktif. Silakan masuk.' : 'Kata sandi berhasil disimpan. Silakan masuk.'
      setMessage(success)
      // Logout failure must never relabel a successful password write as failure.
      try { await actions.logout() }
      catch { setMessage(`${success} Sesi perangkat belum berhasil ditutup; gunakan tombol Masuk untuk melanjutkan.`) }
      rememberPasswordSetup(data.user.id, true)
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Perubahan kata sandi gagal.') }
    finally { setLoading(false) }
  }

  return (
    <AuthLayout panelContent={<ResetIdentity />}>
      <div className="auth-card">
        <div className="auth-card-head">
          <h2 className="auth-card-title">Buat Kata Sandi Baru</h2>
          <p className="auth-card-subtitle">
            Masukkan kode dari email terbaru, lalu buat kata sandi baru.
          </p>
        </div>

        <AuthFeedback type={failed ? 'error' : 'info'}>{message}</AuthFeedback>
        {failed && !ready && <p className="auth-switch"><Link className="auth-link" to="/forgot-password">Minta kode baru</Link></p>}

        {!ready && !done && <form onSubmit={verifyCode} className="auth-form" aria-label="Verifikasi kode pemulihan">
          <FormField id="recovery-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <FormField id="recovery-code" label="Kode dari email" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required />
          <button type="submit" className="button button-red auth-submit" disabled={loading}>{loading ? 'Memverifikasi…' : 'Verifikasi Kode'}</button>
        </form>}

        {ready && !done && <form onSubmit={handleSubmit} noValidate className="auth-form" aria-label="Form reset kata sandi">
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

          <button type="submit" className="button button-red auth-submit" disabled={loading || !ready || done} aria-busy={loading}>
            {loading ? 'Menyimpan…' : 'Simpan Kata Sandi'}
            {!loading && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>}

        <p className="auth-switch">
          <Link to="/login" className={done ? 'button button-red auth-submit' : 'auth-link'}>
            {done ? 'Masuk dengan kata sandi Anda' : 'Kembali ke halaman masuk'}
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
