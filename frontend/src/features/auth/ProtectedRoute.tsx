import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { AuthFeedback } from '../../components/auth/AuthFeedback'
import { useAuth } from './useAuth'
import { useAuthNotifications } from './authNotifications'
import { SessionLoading } from './SessionLoading'

export function ProtectedRoute({ admin = false }: Readonly<{ admin?: boolean }>) {
  const { loading, identity, error, refresh } = useAuth()
  const location = useLocation()
  const { signingOut } = useAuthNotifications()
  if (signingOut && !identity) return <SessionLoading label="Menutup sesi akun…" />
  if (loading) return <SessionLoading />
  if (error) return <div><AuthFeedback type="error">{error}</AuthFeedback><button className="button button-red" onClick={() => void refresh()}>Coba lagi</button><Link to="/login" className="auth-link">Kembali ke halaman masuk</Link></div>
  if (!identity) return <Navigate to="/login" replace state={{ returnTo: location.pathname }} />
  if (admin && identity.role !== 'admin') return <AuthFeedback type="error">Akses administrator ditolak.</AuthFeedback>
  return <Outlet />
}
