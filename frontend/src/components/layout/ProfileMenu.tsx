import { useEffect, useRef, useState } from 'react'
import { LogOut, Settings, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../../features/auth/useAuth'
import { useLogout } from '../../features/auth/useLogout'
import './profile-menu.css'

export function ProfileMenu({ onOpen }: Readonly<{ onOpen?: () => void }>) {
  const { identity } = useAuth()
  const confirmLogout = useLogout()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstAction = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => firstAction.current?.focus())
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const focusOutside = (event: FocusEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    document.addEventListener('focusin', focusOutside)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); document.removeEventListener('focusin', focusOutside) }
  }, [open])

  async function logout() {
    if (busy) return
    setBusy(true); setError('')
    try {
      await confirmLogout()
    } catch {
      setError('Belum berhasil keluar. Periksa koneksi lalu coba lagi.')
    } finally { setBusy(false) }
  }
  if (!identity) return null
  return <div className="profile-menu" ref={container}>
    <button type="button" className="nav-login nav-glass" ref={trigger} aria-label="Menu akun" title="Menu akun" aria-expanded={open} aria-controls="profile-actions" onClick={() => { if (!open) { onOpen?.() }
      setOpen(!open) }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); onOpen?.(); setOpen(true) } }}><UserRound size={20} aria-hidden="true" /></button>
    {open && <fieldset id="profile-actions" className="profile-dropdown nav-glass" aria-label="Tindakan akun">
      <div className="profile-identity"><p>{identity.profile.display_name.trim() || 'Pengguna AWASIN'}</p><span>{identity.email}</span></div>
      <Link ref={firstAction} to="/settings" onClick={() => setOpen(false)}><Settings size={18} aria-hidden="true" />Pengaturan Akun</Link>
      <button type="button" onClick={() => void logout()} disabled={busy}><LogOut size={18} aria-hidden="true" />{busy ? 'Sedang keluar…' : 'Keluar'}</button>
      {error && <p className="profile-error" role="alert">{error}</p>}
    </fieldset>}
  </div>
}
