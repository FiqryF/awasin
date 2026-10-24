import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { ArrowUpRight, LogIn, Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { BrandMark } from '../ui/BrandMark'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useAuth } from '../../features/auth/useAuth'
import { ProfileMenu } from './ProfileMenu'

function NavIndicator({ nav, active, reducedMotion }: Readonly<{ nav: RefObject<HTMLElement | null>; active?: string; reducedMotion: boolean }>) {
  const [position, setPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  useEffect(() => {
    const element = nav.current
    if (!element) return
    const measure = () => {
      const link = element.querySelector<HTMLElement>('a[aria-current]')
      setPosition(link ? { x: link.offsetLeft, y: link.offsetTop + 2, width: link.offsetWidth, height: Math.max(0, link.offsetHeight - 4) } : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [nav, active])
  return position && <motion.span className="nav-active-pill" data-active={active} initial={false} animate={position} transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }} aria-hidden="true" />
}

const navigation = [{ hash: 'beranda', label: 'Beranda' }, { hash: 'periksa', label: 'Periksa' }, { hash: 'edukasi', label: 'Edukasi' }]

export function FloatingNavbar() {
  const location = useLocation()
  const { pathname } = location
  const { identity, loading } = useAuth()
  const home = identity ? '/dashboard' : '/'
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === location.key
  const setOpen = (value: boolean) => setOpenFor(value ? location.key : null)
  const [compact, setCompact] = useState(false)
  const [dark, setDark] = useState(true)
  const [activeSection, setActiveSection] = useState('beranda')
  const header = useRef<HTMLElement>(null)
  const desktopNav = useRef<HTMLElement>(null)
  const darkSections = useRef<Element[]>([])
  const pageSections = useRef<HTMLElement[]>([])
  const trigger = useRef<HTMLButtonElement>(null)
  const { scrollY } = useScroll()
  const reducedMotion = usePrefersReducedMotion()
  const updateTheme = useCallback(() => {
    const bounds = header.current?.getBoundingClientRect()
    const line = bounds ? (bounds.top + bounds.bottom) / 2 : 60
    setDark(darkSections.current.length === 0 || darkSections.current.some((section) => { const rect = section.getBoundingClientRect(); return rect.top <= line && rect.bottom > line }))
    const sectionLine = Math.max(line, window.innerHeight * 0.25)
    const current = pageSections.current.reduce((active, section) => section.getBoundingClientRect().top <= sectionLine ? section.id : active, 'beranda')
    setActiveSection(current)
  }, [])
  // Reuse Motion's frame-batched scroll subscription for the cached dark sections.
  useMotionValueEvent(scrollY, 'change', (value) => { setCompact(value > 48); updateTheme() })
  useEffect(() => {
    let frame = 0
    const collect = () => {
      darkSections.current = Array.from(document.querySelectorAll('[data-nav-theme="dark"]'))
      pageSections.current = navigation.flatMap(({ hash }) => {
        const section = document.getElementById(hash)
        return section ? [section] : []
      })
      setCompact(window.scrollY > 48)
      updateTheme()
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(collect) }
    schedule()
    const observer = new MutationObserver(schedule)
    const main = document.getElementById('main-content')
    if (main) observer.observe(main, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule) }
  }, [pathname, updateTheme, identity?.id, loading])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpenFor(null) }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpenFor(null); trigger.current?.focus() } }
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeDesktop = () => { if (desktop.matches) setOpenFor(null) }
    document.addEventListener('pointerdown', closeOutside); document.addEventListener('keydown', closeEscape); desktop.addEventListener('change', closeDesktop)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); desktop.removeEventListener('change', closeDesktop) }
  }, [open])
  const destination = (hash: string) => pathname === home ? `#${hash}` : `${home}#${hash}`
  const isActive = (hash: string) => pathname === home && activeSection === hash
  const links = [
    { id: 'beranda', label: 'Beranda', to: destination('beranda'), active: isActive('beranda'), current: 'location' as const },
    { id: 'periksa', label: 'Periksa', to: destination('periksa'), active: isActive('periksa')||pathname.startsWith('/scan/'), current: 'location' as const },
    ...(identity ? [{ id: 'history', label: 'Riwayat', to: '/history', active: pathname === '/history'||pathname.startsWith('/history/'), current: 'page' as const }] : []),
    { id: 'edukasi', label: 'Edukasi', to: '/education', active: isActive('edukasi')||pathname==='/education'||pathname.startsWith('/education/'), current: 'page' as const },
    { id: 'feedback', label: 'Feedback', to: '/feedback', active: pathname === '/feedback', current: 'page' as const },
  ]
  return (
    <header ref={header} data-theme={pathname !== home || dark ? 'dark' : 'light'} className={`floating-header${compact ? ' is-compact' : ''}`}>
      <div className="navbar-shell">
        <Link to={`${home}#beranda`} className="nav-brand nav-glass" aria-label="AWASIN, beranda" onClick={() => setOpen(false)}><BrandMark /><span className="wordmark">AWASIN.</span></Link>
        <div className="nav-actions">
          <nav ref={desktopNav} className="desktop-nav nav-glass" aria-label="Navigasi utama"><NavIndicator nav={desktopNav} active={links.find(item => item.active)?.id} reducedMotion={reducedMotion} />{links.map((item) => <Link key={item.id} to={item.to} aria-current={item.active ? item.current : undefined}>{item.label}{item.id === 'feedback' && <ArrowUpRight size={15} aria-hidden="true" />}</Link>)}</nav>
          <button type="button" ref={trigger} className="menu-trigger nav-glass" aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>
          {identity ? <ProfileMenu key={`${identity.id}:${location.key}`} onOpen={() => setOpen(false)} /> : <Link to="/login" className="nav-login nav-glass" aria-label="Masuk ke akun AWASIN" title="Masuk" onClick={() => setOpen(false)}><LogIn size={20} aria-hidden="true" /></Link>}
        </div>
      </div>
      {open && <motion.nav id="mobile-navigation" className="mobile-nav nav-glass" aria-label="Navigasi mobile" initial={reducedMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>
        {links.map((item) => <Link key={item.id} to={item.to} aria-current={item.active ? item.current : undefined} onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={17} aria-hidden="true" /></Link>)}
      </motion.nav>}
    </header>
  )
}
