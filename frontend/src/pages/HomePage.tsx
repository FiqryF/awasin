import { HeroSection } from '../sections/HeroSection'
import { ScanSection } from '../sections/ScanSection'
import { EducationSection } from '../sections/EducationSection'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { identityDestination } from '../features/auth/policy'
import { SessionLoading } from '../features/auth/SessionLoading'

export function HomePage() {
  const { identity, loading } = useAuth()
  const { hash } = useLocation()
  if (loading) return <SessionLoading />
  if (identity) return <Navigate to={`${identityDestination(identity)}${hash}`} replace />
  return <><HeroSection /><ScanSection /><EducationSection /></>
}
