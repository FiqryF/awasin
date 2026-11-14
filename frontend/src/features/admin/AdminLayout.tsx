import { NavLink, Outlet, Link } from 'react-router'
import { LayoutDashboard, MessageSquare, BookOpen, LogOut, Megaphone, UsersRound } from 'lucide-react'
import { BrandMark } from '../../components/ui/BrandMark'
import { useAuth } from '../auth/useAuth'
import { useLogout } from '../auth/useLogout'
import { useState } from 'react'
import './admin.css'

const navigation = [
  { to: '/admin/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/admin/articles', label: 'Konten edukasi', icon: BookOpen },
  { to: '/admin/announcements', label: 'Pengumuman layanan', icon: Megaphone },
  { to: '/admin/users', label: 'Pengguna terdaftar', icon: UsersRound },
]
export function AdminLayout() {
  const { identity } = useAuth()
  const logout = useLogout()
  const [busy, setBusy] = useState(false)
  async function leave() {
    if (busy) return
    setBusy(true)
    try { await logout() }
    catch { /* Existing notification explains logout failure. */ }
    finally { setBusy(false) }
  }
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main">Lewati navigasi admin</a>
      <aside className="admin-sidebar">
        <Link to="/admin/dashboard" className="admin-brand">
          <BrandMark /><strong>AWASIN<span>Panel admin</span></strong>
        </Link>
        <nav aria-label="Navigasi administrator">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}><Icon size={19} aria-hidden="true" />{label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-identity">
            <strong>{identity?.profile.display_name || 'Administrator'}</strong>
            <span>Administrator</span>
          </div>
          <span className="admin-account-mark"><BrandMark /></span>
          <button type="button" disabled={busy} onClick={() => void leave()} aria-label="Keluar dari akun" title="Keluar dari akun">
            <LogOut size={19} aria-hidden="true" />
          </button>
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  )
}
