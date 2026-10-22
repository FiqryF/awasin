import { Outlet, useLocation } from 'react-router'
import { FloatingNavbar } from '../components/layout/FloatingNavbar'
import { Footer } from '../components/layout/Footer'
import { RouteAnnouncer } from '../components/common/RouteAnnouncer'

export function MainLayout() {
  const { pathname } = useLocation()
  const fullWidth = pathname === '/' || pathname === '/feedback'
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">Lewati ke konten utama</a>
      {pathname !== '/feedback' && <FloatingNavbar />}
      <RouteAnnouncer />
      <main id="main-content" tabIndex={-1} data-nav-theme={pathname === '/' ? undefined : 'dark'} className={fullWidth ? 'landing-main' : 'page-width placeholder-main'}><Outlet /></main>
      <Footer />
    </div>
  )
}
