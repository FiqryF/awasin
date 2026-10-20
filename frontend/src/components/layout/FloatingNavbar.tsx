import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, LogIn, Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { BrandMark } from '../ui/BrandMark'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

const navigation = [{ hash: 'beranda', label: 'Beranda' }, { hash: 'periksa', label: 'Periksa' }, { hash: 'edukasi', label: 'Edukasi' }]

export function FloatingNavbar() {
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [dark, setDark] = useState(true)
  const [activeSection, setActiveSection] = useState('beranda')
  const header = useRef<HTMLElement>(null)
  const darkSections = useRef<Element[]>([])
  const pageSections = useRef<HTMLElement[]>([])
  const trigger = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const { scrollY } = useScroll()
  const reducedMotion = usePrefersReducedMotion()
  const updateTheme = useCallback(() => {
    const bounds = header.current?.getBoundingClientRect()
    const line = bounds ? (bounds.top + bounds.bottom) / 2 : 60
    setDark(darkSections.current.some((section) => { const rect = section.getBoundingClientRect(); return rect.top <= line && rect.bottom > line }))
    const sectionLine = Math.max(line, window.innerHeight * 0.25)
    const current = pageSections.current.reduce((active, section) => section.getBoundingClientRect().top <= sectionLine ? section.id : active, 'beranda')
    setActiveSection(current)
  }, [])
  // Reuse Motion's frame-batched scroll subscription for the cached dark sections.
  useMotionValueEvent(scrollY, 'change', (value) => { setCompact(value > 48); updateTheme() })
  useEffect(() => {
    darkSections.current = Array.from(document.querySelectorAll('[data-nav-theme="dark"]'))
    pageSections.current = navigation.flatMap(({ hash }) => {
      const section = document.getElementById(hash)
      return section ? [section] : []
    })
    const frame = requestAnimationFrame(updateTheme)
    window.addEventListener('resize', updateTheme)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', updateTheme) }
  }, [pathname, updateTheme])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false) }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeDesktop = () => { if (desktop.matches) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside); document.addEventListener('keydown', closeEscape); desktop.addEventListener('change', closeDesktop)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); desktop.removeEventListener('change', closeDesktop) }
  }, [open])
  const destination = (hash: string) => pathname === '/' ? `#${hash}` : `/#${hash}`
  const isActive = (hash: string) => pathname === '/' && activeSection === hash
  return (
    <header ref={header} data-theme={dark ? 'dark' : 'light'} className={`floating-header${compact ? ' is-compact' : ''}`}>
      <div className="navbar-shell">
        <Link to="/#beranda" className="nav-brand" aria-label="AWASIN, beranda" onClick={() => setOpen(false)}><BrandMark /><span className="wordmark">AWASIN.</span></Link>
        <div className="nav-actions">
          <nav className="desktop-nav nav-glass" aria-label="Navigasi utama">{navigation.map(({ hash, label }) => <Link key={hash} to={destination(hash)} aria-current={isActive(hash) ? 'location' : undefined}>{isActive(hash) && <motion.span className="nav-active-pill" layoutId="header-active-section" initial={false} transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }} aria-hidden="true" />}{label}</Link>)}<Link to="/feedback" aria-current={pathname === '/feedback' ? 'page' : undefined}>Feedback <ArrowUpRight size={15} aria-hidden="true" /></Link></nav>
          <button type="button" ref={trigger} className="menu-trigger nav-glass" aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>
          <Link to="/login" className="nav-login nav-glass" aria-label="Masuk ke akun AWASIN" title="Masuk" onClick={() => setOpen(false)}><LogIn size={20} aria-hidden="true" /></Link>
        </div>
      </div>
      {open && <motion.nav id="mobile-navigation" className="mobile-nav nav-glass" aria-label="Navigasi mobile" initial={reducedMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>
        {navigation.map(({ hash, label }) => <Link key={hash} to={destination(hash)} aria-current={isActive(hash) ? 'location' : undefined} onClick={() => setOpen(false)}>{label}<ArrowUpRight size={17} aria-hidden="true" /></Link>)}
        <Link to="/feedback" onClick={() => setOpen(false)}>Feedback<ArrowUpRight size={17} aria-hidden="true" /></Link>
      </motion.nav>}
    </header>
  )
}
