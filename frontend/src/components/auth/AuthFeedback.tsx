import { ShieldCheck, AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

type AuthFeedbackProps = {
  type: 'info' | 'error' | 'dev'
  children: ReactNode
}

export function AuthFeedback({ type, children }: AuthFeedbackProps) {
  return (
    <div className={`auth-feedback auth-feedback-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'error' ? (
        <AlertCircle size={16} aria-hidden="true" />
      ) : (
        <ShieldCheck size={16} aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  )
}
