import { NavLink, Outlet, Link } from 'react-router'
import { LayoutDashboard, MessageSquare, Globe2, BookOpen, ScrollText, LogOut, Settings, ArrowUpRight } from 'lucide-react'
import { BrandMark } from '../../components/ui/BrandMark'
import { useAuth } from '../auth/useAuth'
import { useLogout } from '../auth/useLogout'
import { useState } from 'react'
import './admin.css'

const navigation = [
  { to: '/admin/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/admin/domains', label: 'Registry domain', icon: Globe2 },
  { to: '/admin/articles', label: 'Konten edukasi', icon: BookOpen },
  { to: '/admin/audit', label: 'Jejak audit', icon: ScrollText },
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
  return <div className="admin-shell"><a className="skip-link" href="#admin-main">Lewati navigasi admin</a><aside className="admin-sidebar"><Link to="/admin/dashboard" className="admin-brand"><BrandMark /><strong>AWASIN<span>WORKSPACE ADMIN</span></strong></Link><nav aria-label="Navigasi administrator">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon size={19} aria-hidden="true" />{label}</NavLink>)}</nav><div className="admin-sidebar-foot"><p>Referensi yang ditinjau.<br />Keputusan yang tercatat.</p><Link to="/">Lihat situs publik <ArrowUpRight size={16} aria-hidden="true" /></Link></div></aside><div className="admin-workspace"><header className="admin-topbar"><span className="admin-role">ADMINISTRATOR</span><span className="admin-identity">{identity?.profile.display_name || 'Administrator'}</span><Link to="/settings" aria-label="Pengaturan akun"><Settings size={19} /></Link><button type="button" disabled={busy} onClick={() => void leave()} aria-label="Keluar dari akun"><LogOut size={19} /></button></header><main id="admin-main" className="admin-main"><Outlet /></main><footer className="admin-footer">AWASIN · Ruang pengelolaan dengan akses terbatas.</footer></div></div>
}
