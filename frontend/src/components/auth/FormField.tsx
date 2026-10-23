import { AlertCircle } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
  hint?: string
  /** Slot untuk tombol/addon di dalam field (mis. toggle password) */
  suffix?: ReactNode
}

export function FormField({ id, label, error, hint, suffix, className, ...rest }: FormFieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const described = [error ? errorId : '', hint && !error ? hintId : ''].filter(Boolean).join(' ') || undefined
  const inputClassName = ['auth-input', error && 'is-invalid', className].filter(Boolean).join(' ')

  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <div className={`auth-input-wrap${suffix ? ' has-suffix' : ''}`}>
        <input
          id={id}
          className={inputClassName}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={described}
          {...rest}
        />
        {suffix && <div className="auth-input-suffix">{suffix}</div>}
      </div>
      {error && (
        <p id={errorId} className="auth-field-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="auth-field-hint">
          {hint}
        </p>
      )}
    </div>
  )
}
