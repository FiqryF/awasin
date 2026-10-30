import { Navigate } from 'react-router'

// Keep old bookmarks compatible without requiring registration email verification.
export function VerifyEmailPage() {
  return <Navigate to="/login" replace />
}
