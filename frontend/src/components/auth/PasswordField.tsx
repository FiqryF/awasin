import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { FormField } from './FormField'

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  autoComplete?: string
}

export function PasswordField({ id, label, value, onChange, error, hint, autoComplete = 'current-password' }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  const toggle = (
    <button
      type="button"
      className="auth-pw-toggle"
      aria-label={visible ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
      onClick={() => setVisible((v) => !v)}
      tabIndex={0}
    >
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  )

  return (
    <FormField
      id={id}
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      error={error}
      hint={hint}
      suffix={toggle}
    />
  )
}
