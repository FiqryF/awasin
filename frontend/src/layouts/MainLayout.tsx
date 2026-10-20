import { Outlet } from 'react-router'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { RouteAnnouncer } from '../components/common/RouteAnnouncer'

export function MainLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">Lewati ke konten utama</a>
      <Header />
      <RouteAnnouncer />
      <main id="main-content" tabIndex={-1} className="page-width flex-1 py-12 sm:py-16"><Outlet /></main>
      <Footer />
    </div>
  )
}
