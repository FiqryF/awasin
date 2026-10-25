import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { AuthNotificationContext, type AuthNotification } from './authNotifications'
import './auth-notifications.css'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useNotificationMotion } from './useNotificationMotion'

function Notification({ notice, dismiss }: Readonly<{ notice: AuthNotification; dismiss: () => void }>) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  const card = useRef<HTMLElement>(null)
  const progress = useRef<HTMLSpanElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const close = useNotificationMotion(card, progress, notice.tone === 'success', hovered || focused || hidden, reducedMotion, dismiss)
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  const Icon = notice.tone === 'success' ? CircleCheck : TriangleAlert
  return <div className="auth-notification-stage"><aside ref={card} className="auth-notification" data-tone={notice.tone} aria-label="Pemberitahuan akun"
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <button type="button" aria-label="Tutup pemberitahuan" onClick={close}><X size={18} aria-hidden="true" /></button>
    <span className="auth-notification-icon"><Icon size={36} strokeWidth={1.6} aria-hidden="true" /></span>
    <output aria-live="off"><strong>{notice.title}</strong><span>{notice.message}</span></output>
    {notice.tone === 'success' && <span className="auth-notification-progress" aria-hidden="true"><span ref={progress} /></span>}
  </aside></div>
}

export function AuthNotificationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [notice, setNotice] = useState<(AuthNotification & { id: number }) | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [returningHome, setReturningHome] = useState(false)
  const sequence = useRef(0)
  const pending = useRef(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const goToPublicHome = useCallback(() => { setReturningHome(true); return navigate('/', { replace: true }) }, [navigate])
  const notify = useCallback((next: AuthNotification) => setNotice({ ...next, id: ++sequence.current }), [])
  const dismiss = useCallback(() => setNotice(null), [])
  const beginLogout = useCallback(() => {
    if (pending.current) return false
    pending.current = true
    setSigningOut(true)
    return true
  }, [])
  const finishLogout = useCallback(() => { pending.current = false; setSigningOut(false); setReturningHome(false) }, [])
  useEffect(() => {
    // Router navigation can commit later than ordinary state updates.
    // Keep the protected-route guard blocked until public home is mounted.
    if (!returningHome || pathname !== '/') return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    let active = true
    queueMicrotask(() => { if (active) finishLogout() })
    return () => { active = false }
  }, [returningHome, pathname, finishLogout])
  const value = useMemo(() => ({ notify, signingOut, beginLogout, finishLogout, goToPublicHome }), [notify, signingOut, beginLogout, finishLogout, goToPublicHome])
  return <AuthNotificationContext.Provider value={value}>{children}<output className="sr-only" aria-live="polite" aria-atomic="true">{notice && `${notice.title}. ${notice.message}`}</output>{notice && <Notification key={notice.id} notice={notice} dismiss={dismiss} />}</AuthNotificationContext.Provider>
}
