import { useAuth } from '../features/auth/useAuth'
import { HeroSection } from '../sections/HeroSection'
import { ScanSection } from '../sections/ScanSection'
import { EducationSection } from '../sections/EducationSection'
import './dashboard.css'
import { RecentHistory } from '../features/history/RecentHistory'

export function DashboardPage() {
  const { identity } = useAuth()
  // Identity comes from the protected route's existing server verification.
  if (!identity) return null
  return <div className="dashboard-page" key={identity.id}>
    <HeroSection personalized displayName={identity.profile.display_name.trim()} />
    <ScanSection personalized />
    <RecentHistory/>
    <EducationSection personalized />
  </div>
}
