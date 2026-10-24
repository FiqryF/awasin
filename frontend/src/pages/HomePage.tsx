import { HeroSection } from '../sections/HeroSection'
import { ScanSection } from '../sections/ScanSection'
import { EducationSection } from '../sections/EducationSection'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { identityDestination } from '../features/auth/policy'

export function HomePage() {
  const { identity, loading } = useAuth()
  const { hash } = useLocation()
  if (loading) return <output className="route-loading">Memverifikasi sesi…</output>
  if (identity) return <Navigate to={`${identityDestination(identity)}${hash}`} replace />
  return <><HeroSection /><ScanSection /><EducationSection /></>
}
