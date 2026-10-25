import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Fragment, StrictMode, act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { AuthNotificationProvider } from '../src/features/auth/AuthNotificationProvider'
import { AuthSessionGate } from '../src/features/auth/AuthSessionGate'
import { useAuthNotifications } from '../src/features/auth/authNotifications'
import { useAuth } from '../src/features/auth/useAuth'
import { ProtectedRoute } from '../src/features/auth/ProtectedRoute'
import { ProfileMenu } from '../src/components/layout/ProfileMenu'
import { LoginPage } from '../src/pages/auth/LoginPage'
import { fetchIdentity } from '../src/features/auth/identity'

const sdk = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn() }))
const motion = vi.hoisted(() => ({ animate: vi.fn() }))
vi.mock('motion/react', async original => ({ ...await original<object>(), animate: motion.animate }))
vi.mock('../src/features/auth/client', () => ({ supabase: { auth: sdk }, requireSupabase: () => ({ auth: sdk }) }))
vi.mock('../src/features/auth/identity', () => ({ fetchIdentity: vi.fn() }))
const identity = { id: 'fixture-user', email: 'fixture@example.invalid', role: 'user' as const, aal: 'aal1' as const, profile: { id: 'fixture-user', display_name: 'Fixture' } }
const session = { access_token: `header.${btoa(JSON.stringify({ session_id: 'notice-session' }))}.signature`, user: { id: identity.id } }
let stored: typeof session | null
let authEvent: (event: string, session: typeof stored) => void
let cleanup: (() => void) | undefined
const paths: string[] = []
type MotionRecord = { target: Element; duration: number; finished: Promise<void>; complete: () => void; stop: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> }
let animations: MotionRecord[] = []
function latestAnimation(host: HTMLElement, selector: string) {
  return animations.filter(animation => animation.target === host.querySelector(selector)).at(-1)!
}
async function completeAnimation(animation: MotionRecord) { await act(async () => animation.complete()) }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  window.scrollTo = vi.fn()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  stored = null; paths.length = 0; localStorage.clear(); sessionStorage.clear()
  animations = []
  motion.animate.mockImplementation((target: Element, _frames: unknown, options: { duration: number }) => {
    let complete!: () => void
    const finished = new Promise<void>(resolve => { complete = resolve })
    const control = { target, duration: options.duration, finished, complete, stop: vi.fn(), pause: vi.fn(), play: vi.fn() }
    animations.push(control)
    return control
  })
  sdk.getSession.mockImplementation(async () => ({ data: { session: stored }, error: null }))
  sdk.onAuthStateChange.mockImplementation(callback => { authEvent = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } })
  sdk.signOut.mockImplementation(async () => { stored = null; authEvent('SIGNED_OUT', null); return { error: null } })
  sdk.signInWithPassword.mockImplementation(async () => { stored = session; authEvent('SIGNED_IN', session); return { data: { session, user: { email_confirmed_at: '2026-01-01' } }, error: null } })
  vi.mocked(fetchIdentity).mockResolvedValue(identity)
})
afterEach(async () => {
  if (cleanup) await act(async () => cleanup?.())
  cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals()
})
function Screens() {
  const { identity: account } = useAuth()
  const { pathname } = useLocation()
  useEffect(() => { paths.push(pathname) }, [pathname])
  // PreferencesProvider also replaces its route subtree when the account changes.
  return <Fragment key={account?.id ?? 'guest'}><Routes><Route path="/" element={<h1>PUBLIC HOME</h1>} /><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route path="/dashboard" element={<><h1>ACCOUNT HOME</h1><ProfileMenu /></>} /></Route></Routes></Fragment>
}
async function render(path = '/login', fixture?: React.ReactNode) {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  cleanup = () => { root.unmount(); host.remove() }
  await act(async () => root.render(<StrictMode><MemoryRouter initialEntries={[path]}><AuthNotificationProvider>{fixture ?? <AuthProvider><AuthSessionGate><Screens /></AuthSessionGate></AuthProvider>}</AuthNotificationProvider></MemoryRouter></StrictMode>))
  return host
}
async function click(element: Element) { await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })) }) }
async function login(host: HTMLElement) {
  await act(async () => {
    for (const [id, value] of [['login-email', identity.email], ['login-password', 'fixture-password']]) {
      const input = host.querySelector<HTMLInputElement>(`#${id}`)!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}
async function logout(host: HTMLElement) {
  await click(host.querySelector('[aria-label="Menu akun"]')!)
  await click(host.querySelector('#profile-actions button')!)
}
it('announces login only after backend identity verification, surviving the account subtree replacement', async () => {
  const host = await render()
  let confirm!: (value: typeof identity) => void
  vi.mocked(fetchIdentity).mockImplementation(() => new Promise(resolve => { confirm = resolve }))
  await login(host)
  expect(host.querySelector('.auth-notification')).toBeNull()
  await act(async () => { confirm(identity) })
  expect(host.querySelector('h1')?.textContent).toBe('ACCOUNT HOME')
  expect(host.querySelectorAll('.auth-notification')).toHaveLength(1)
  expect(host.querySelector('.auth-notification strong')?.textContent).toBe('Berhasil masuk')
})
it('never announces login success when credentials or backend verification fail', async () => {
  const host = await render()
  sdk.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: { code: 'invalid_credentials' } })
  await login(host)
  expect(host.querySelector('.auth-notification')).toBeNull()
  vi.mocked(fetchIdentity).mockRejectedValue(new Error('Sesi tidak valid.'))
  await login(host)
  expect(host.querySelector('.auth-notification')).toBeNull()
  expect(host.textContent).toContain('Sesi tidak valid.')
})
it('does not replay a login success notification on session restoration', async () => {
  stored = session
  const host = await render('/dashboard')
  expect(host.querySelector('h1')?.textContent).toBe('ACCOUNT HOME')
  expect(host.querySelector('.auth-notification')).toBeNull()
})
it('waits for sign-out confirmation and ends at public home without visiting login', async () => {
  stored = session
  const host = await render('/dashboard')
  let complete!: () => void
  sdk.signOut.mockImplementation(() => {
    stored = null; authEvent('SIGNED_OUT', null)
    return new Promise(resolve => { complete = () => resolve({ error: null }) })
  })
  await logout(host)
  expect(host.querySelector('.auth-notification')).toBeNull()
  expect(paths).not.toContain('/login')
  await act(async () => complete())
  expect(host.querySelector('.auth-notification')?.textContent).toContain('Anda sudah keluar')
  expect(host.querySelector('h1')?.textContent).toBe('PUBLIC HOME')
  expect(paths).not.toContain('/login')
  expect(host.querySelector('.auth-notification strong')?.textContent).toBe('Anda sudah keluar')
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
})
it('does not announce success if the provider returns success but leaves a session active', async () => {
  stored = session
  const host = await render('/dashboard')
  sdk.signOut.mockResolvedValueOnce({ error: null })
  await logout(host)
  expect(host.querySelector('h1')?.textContent).toBe('ACCOUNT HOME')
  expect(host.querySelector('.auth-notification')?.getAttribute('data-tone')).toBe('error')
  expect(host.querySelector('.auth-notification strong')?.textContent).toBe('Logout belum terkonfirmasi')
})
it('distinguishes confirmed local logout from an unconfirmed remote revocation', async () => {
  stored = session
  const host = await render('/dashboard')
  sdk.signOut.mockImplementationOnce(async () => { stored = null; authEvent('SIGNED_OUT', null); return { error: { name: 'AuthRetryableFetchError' } } })
  await logout(host)
  expect(host.querySelector('h1')?.textContent).toBe('PUBLIC HOME')
  expect(host.querySelector('.auth-notification')?.getAttribute('data-tone')).toBe('warning')
  expect(host.querySelector('.auth-notification')?.textContent).toContain('belum dapat dikonfirmasi')
})
it('keeps a failed logout visible and permits retry', async () => {
  stored = session
  const host = await render('/dashboard')
  sdk.signOut.mockResolvedValueOnce({ error: { name: 'AuthRetryableFetchError' } })
  await logout(host)
  expect(host.querySelector('.auth-notification')?.getAttribute('data-tone')).toBe('error')
  expect(host.querySelector('h1')?.textContent).toBe('ACCOUNT HOME')
  await click(host.querySelector('#profile-actions button')!)
  expect(host.querySelector('h1')?.textContent).toBe('PUBLIC HOME')
  expect(host.querySelector('.auth-notification')?.getAttribute('data-tone')).toBe('success')
})
it('pauses the lifetime animation while focused and waits for the exit animation when dismissed', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  function Trigger() { const { notify } = useAuthNotifications(); return <button type="button" onClick={() => notify({ title: 'Verified fixture', message: 'Confirmed by a test fixture.', tone: 'success' })}>Notify</button> }
  const host = await render('/', <Trigger />)
  await click(host.querySelector('button')!)
  expect(latestAnimation(host, '.auth-notification').duration).toBe(.08)
  await completeAnimation(latestAnimation(host, '.auth-notification'))
  const hold = latestAnimation(host, '.auth-notification-progress > span')
  expect(hold.duration).toBe(2.6)
  await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label="Tutup pemberitahuan"]')!.focus() })
  await act(async () => { vi.advanceTimersByTime(9000) })
  expect(host.querySelector('.auth-notification')).not.toBeNull()
  expect(hold.pause).toHaveBeenCalled()
  await click(host.querySelector('[aria-label="Tutup pemberitahuan"]')!)
  expect(host.querySelector('.auth-notification')).not.toBeNull()
  await completeAnimation(latestAnimation(host, '.auth-notification'))
  expect(host.querySelector('.auth-notification')).toBeNull()
})
it('dismisses only when the entrance, countdown, and exit animations complete', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  function Trigger() { const { notify } = useAuthNotifications(); return <button type="button" onClick={() => notify({ title: 'Verified fixture', message: 'Confirmed by a test fixture.', tone: 'success' })}>Notify</button> }
  const host = await render('/', <Trigger />)
  await click(host.querySelector('button')!)
  expect(latestAnimation(host, '.auth-notification').duration).toBe(.28)
  await act(async () => { vi.advanceTimersByTime(30_000) })
  expect(host.querySelector('.auth-notification')).not.toBeNull()
  await completeAnimation(latestAnimation(host, '.auth-notification'))
  await completeAnimation(latestAnimation(host, '.auth-notification-progress > span'))
  expect(host.querySelector('.auth-notification')).not.toBeNull()
  expect(latestAnimation(host, '.auth-notification').duration).toBe(.18)
  await completeAnimation(latestAnimation(host, '.auth-notification'))
  expect(host.querySelector('.auth-notification')).toBeNull()
})
it('pauses the countdown while the document is hidden and resumes it on return', async () => {
  let visibility: DocumentVisibilityState = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  function Trigger() { const { notify } = useAuthNotifications(); return <button type="button" onClick={() => notify({ title: 'Verified fixture', message: 'Confirmed by a test fixture.', tone: 'success' })}>Notify</button> }
  const host = await render('/', <Trigger />)
  await click(host.querySelector('button')!)
  await completeAnimation(latestAnimation(host, '.auth-notification'))
  const hold = latestAnimation(host, '.auth-notification-progress > span')
  await act(async () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')) })
  expect(hold.pause).toHaveBeenCalled()
  await act(async () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')) })
  expect(hold.play).toHaveBeenCalled()
})
it('ignores an old animation completion after a newer notification replaces it', async () => {
  function Trigger() { const { notify } = useAuthNotifications(); return <button type="button" onClick={() => notify({ title: 'Latest fixture', message: 'Confirmed by a test fixture.', tone: 'success' })}>Notify</button> }
  const host = await render('/', <Trigger />)
  await click(host.querySelector('button')!)
  const old = latestAnimation(host, '.auth-notification')
  await click(host.querySelector('button')!)
  expect(old.stop).toHaveBeenCalled()
  await completeAnimation(old)
  expect(host.querySelector('.auth-notification strong')?.textContent).toBe('Latest fixture')
})
