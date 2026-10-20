import { ShieldCheck } from 'lucide-react'
import { Link, NavLink } from 'react-router'

export function Header() {
  return (
    <header className="border-b border-line bg-white">
      <div className="page-width flex flex-wrap items-center justify-between gap-5 py-5">
        <Link to="/" aria-label="AWASIN, beranda" className="flex items-center gap-2 text-xl font-bold tracking-wide text-brand">
          <ShieldCheck aria-hidden="true" size={26} /> AWASIN
        </Link>
        <nav aria-label="Navigasi utama" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
          <NavLink to="/" end>Beranda</NavLink>
          <NavLink to="/education">Edukasi</NavLink>
          <NavLink to="/feedback">Feedback</NavLink>
        </nav>
      </div>
    </header>
  )
}
