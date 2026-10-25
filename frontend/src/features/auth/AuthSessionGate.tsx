import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { SessionLoading } from './SessionLoading'

export function AuthSessionGate({ children }: Readonly<{ children: ReactNode }>) {
  const { loading, identity } = useAuth()
  if (loading && !identity) return <SessionLoading />
  return children
}
