import { useEffect, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import { AuthFeedback } from '../components/auth/AuthFeedback'
import { PasswordField } from '../components/auth/PasswordField'
import { FormField } from '../components/auth/FormField'
import { requireSupabase } from '../features/auth/client'
import { createAuthActions, PasswordAlreadySetError } from '../features/auth/actions'
import { fetchIdentity } from '../features/auth/identity'
import { useAuth } from '../features/auth/useAuth'
import { API_BASE_URL } from '../services/api'

export function AccountPage({ admin = false, settings = false }: Readonly<{ admin?: boolean; settings?: boolean }>) {
  const { identity, refresh } = useAuth()
  const [verified, setVerified] = useState(!admin)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(identity?.profile.display_name ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nonce, setNonce] = useState('')
  const navigate = useNavigate()
  let heading = 'Dashboard Pengguna'
  if (admin) heading = 'Dashboard Administrator'
  else if (settings) heading = 'Pengaturan Akun'
  useEffect(() => {
    if (!admin) return
    let active = true
    void requireSupabase().auth.getSession().then(async ({ data }) => {
      if (!data.session) throw new Error('Sesi berakhir.')
      await fetchIdentity(data.session.access_token, true)
      if (active) setVerified(true)
    }).catch(() => { if (active) { setVerified(false); setMessage('Akses admin belum terverifikasi atau sudah dicabut.') } })
    return () => { active = false }
  }, [admin, identity?.id, identity?.role, identity?.aal])

  function reportError(error: unknown) {
    if (error instanceof TypeError) setMessage('Layanan akun tidak dapat dihubungi. Periksa koneksi lalu coba lagi.')
    else if (error instanceof Error) setMessage(error.message)
    else setMessage('Permintaan gagal. Coba lagi.')
  }
  async function perform(operation: () => Promise<void>) {
    if (busy) return
    setBusy(true); setMessage('')
    try { await operation() }
    catch (error) { reportError(error) }
    finally { setBusy(false) }
  }
  async function saveProfile(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    await perform(async () => {
      const { data } = await requireSupabase().auth.getSession()
      if (!data.session) throw new Error('Sesi berakhir.')
      const response = await fetch(`${API_BASE_URL}/api/v1/profiles/me`, { method: 'PATCH', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: name.trim() }), cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Profil belum dapat diperbarui.')
      await refresh(); setMessage('Profil diperbarui.')
    })
  }
  async function changePassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    await perform(async () => {
      if (!/^\d{6,10}$/.test(nonce)) throw new Error('Masukkan kode reautentikasi dari email.')
      const actions = createAuthActions(requireSupabase(), window.location.origin)
      try { await actions.updatePassword(password, confirm, nonce) }
      catch (error) {
        if (!(error instanceof PasswordAlreadySetError)) {
          throw error
        }
        setPassword(''); setConfirm(''); setNonce(''); setMessage('Kata sandi tersebut sudah aktif. Tidak ada perubahan yang diperlukan.')
        return
      }
      setPassword(''); setConfirm(''); setNonce('')
      setMessage('Kata sandi berhasil disimpan.')
      try { await actions.logout() }
      catch { setMessage('Kata sandi berhasil disimpan. Sesi perangkat belum ditutup; klik Keluar dari perangkat ini untuk mencobanya lagi.'); return }
      void refresh().catch(() => undefined)
      await navigate('/login', { replace: true })
    })
  }
  async function requestReauthentication() {
    const { error } = await requireSupabase().auth.reauthenticate()
    if (error) {
      throw new Error('Kode belum dapat dikirim.')
    }
    setMessage('Jika memenuhi syarat, kode reautentikasi dikirim ke email.')
  }
  async function logout() {
    await createAuthActions(requireSupabase(), window.location.origin).logout()
    await refresh()
    await navigate('/', { replace: true })
  }
  return <section className="max-w-xl"><h1 className="text-3xl font-bold">{heading}</h1>
    {message && <AuthFeedback type="info">{message}</AuthFeedback>}
    {verified && identity && <div className="auth-card mt-8">
      <p>{identity.profile.display_name || 'Pengguna AWASIN'} · {identity.email}</p>
      <p>Role terverifikasi: {identity.role}.</p>
      <p>Fitur dashboard berikutnya belum tersedia.</p>
      <form onSubmit={saveProfile} className="auth-form"><FormField id="profile-name" label="Nama tampilan" value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} /><button type="submit" className="button button-red" disabled={busy}>Simpan profil</button></form>
      <h2 className="auth-card-title">Ubah kata sandi</h2>
      <button type="button" className="button button-red" disabled={busy} onClick={() => { perform(requestReauthentication).catch(reportError) }}>Minta kode reautentikasi</button>
      <form onSubmit={changePassword} className="auth-form"><FormField id="reauth-code" label="Kode dari email" value={nonce} inputMode="numeric" autoComplete="one-time-code" onChange={(event) => setNonce(event.target.value)} /><PasswordField id="new-password" label="Kata sandi baru" value={password} onChange={setPassword} autoComplete="new-password" hint="12–128 karakter" /><PasswordField id="new-password-confirm" label="Konfirmasi kata sandi" value={confirm} onChange={setConfirm} autoComplete="new-password" /><button type="submit" className="button button-red" disabled={busy}>Ubah kata sandi</button></form>
    </div>}
    <button type="button" className="button button-red mt-8" disabled={busy} onClick={() => { perform(logout).catch(reportError) }}>Keluar dari perangkat ini</button>
  </section>
}
