import { Outlet, useLocation } from 'react-router'
import { Suspense } from 'react'
import { RouteBoundary } from '../components/common/RouteBoundary'
import { FloatingNavbar } from '../components/layout/FloatingNavbar'
import { Footer } from '../components/layout/Footer'
import { RouteAnnouncer } from '../components/common/RouteAnnouncer'
import { SessionLoading } from '../features/auth/SessionLoading'
import { AnnouncementsProvider } from '../features/announcements/AnnouncementsProvider'

export function MainLayout() {
  const { pathname } = useLocation()
  const fullWidth = pathname === '/' || pathname === '/feedback' || pathname === '/dashboard'
  const compactTop = pathname === '/education' || pathname === '/history' || pathname.startsWith('/history/')
  const pageClass = compactTop ? 'page-width placeholder-main compact-page-main' : 'page-width placeholder-main'
  return (
    <AnnouncementsProvider><div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">Lewati ke konten utama</a>
      {pathname !== '/feedback' && <FloatingNavbar />}
      <RouteAnnouncer />
      <main id="main-content" tabIndex={-1} data-nav-theme={pathname === '/' || pathname === '/dashboard' ? undefined : 'dark'} className={fullWidth ? 'landing-main' : pageClass}><RouteBoundary inLayout resetKey={pathname}><Suspense fallback={<SessionLoading label="Memuat halaman…" />}><Outlet /></Suspense></RouteBoundary></main>
      <Footer />
    </div></AnnouncementsProvider>
  )
}
