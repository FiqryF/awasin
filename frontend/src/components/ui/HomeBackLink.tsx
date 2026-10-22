import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

export function HomeBackLink({ className = '', to = '/', label = 'Kembali ke beranda' }: Readonly<{ className?: string; to?: string; label?: string }>) {
  return (
    <Link to={to} className={`home-back-link ${className}`} aria-label={label} title={label}>
      <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  )
}
