import { LoaderCircle } from 'lucide-react'
import { BrandMark } from '../../components/ui/BrandMark'
import './session-loading.css'

export function SessionLoading({ label = 'Memverifikasi sesi…' }: Readonly<{ label?: string }>) {
  return <section className="session-loading" data-theme="dark" aria-busy="true" aria-label={label}>
    <div className="session-loading-content">
      <div className="session-loading-brand"><BrandMark /><span>AWASIN.</span></div>
      <LoaderCircle className="session-loading-spinner" size={36} strokeWidth={1.5} aria-hidden="true" />
      <output aria-live="polite">{label}</output>
      <p>Menyiapkan halaman Anda.</p>
    </div>
  </section>
}
