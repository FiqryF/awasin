import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAuthActions, loginFailure } from '../src/features/auth/actions'
import { identityDestination, passwordError, safeReturnPath } from '../src/features/auth/policy'
import { ProtectedRoute } from '../src/features/auth/ProtectedRoute'
import { AuthContext } from '../src/features/auth/context'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { fetchIdentity } from '../src/features/auth/identity'
import { useAuth } from '../src/features/auth/useAuth'
import { LoginPage } from '../src/pages/auth/LoginPage'
import { RegisterPage } from '../src/pages/auth/RegisterPage'
import { VerifyEmailPage } from '../src/pages/auth/VerifyEmailPage'

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), exchangeCodeForSession: vi.fn(), signOut: vi.fn(), signUp: vi.fn(),
}))
vi.mock('../src/features/auth/client', () => ({
  supabase: { auth: mock }, requireSupabase: () => ({ auth: mock }),
}))
vi.mock('../src/features/auth/identity', () => ({ fetchIdentity: vi.fn() }))

const verified = { id: 'local-user', email: 'local@example.invalid', role: 'user' as const, aal: 'aal1' as const, profile: { id: 'local-user', display_name: 'Test' } }
const cleanups: (() => void)[] = []
let authEvent: (event: string, session: { access_token: string; user?: { id: string } } | null) => void

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia
  localStorage.clear()
  sessionStorage.clear()
  mock.signOut.mockResolvedValue({ error: null })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mock.onAuthStateChange.mockImplementation((callback) => { authEvent = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } })
  vi.mocked(fetchIdentity).mockResolvedValue(verified)
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await act(async () => cleanup())
  vi.useRealTimers()
})

async function render(element: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  cleanups.push(() => { root.unmount(); container.remove() })
  await act(async () => root.render(element))
  return container
}

function fakeClient() {
  const user = { id: verified.id, email_confirmed_at: '2026-10-29', is_anonymous: false }
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user, session: { access_token: 'signup-fixture', user } }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: crypto.randomUUID() }, user: { email_confirmed_at: '2026-01-01' } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }), signOut: vi.fn().mockResolvedValue({ error: null }),
  }
  return { auth, actions: createAuthActions({ auth } as unknown as SupabaseClient, 'https://awasin.example') }
}

describe('account actions using mocked Supabase SDK', () => {
  it('accepts immediate signup without email confirmation redirects or role metadata', async () => {
    const { actions, auth } = fakeClient()
    expect((await actions.register('person@example.invalid', 'long passphrase test', 'long passphrase test', 'Person')).user.id).toBe(verified.id)
    expect(auth.signUp.mock.calls[0][0].options).toEqual({ data: { display_name: 'Person' } })
    expect(auth.signOut).not.toHaveBeenCalled()
  })
  it.each([
    ['invalid', 'long passphrase test', 'long passphrase test'],
    ['person@example.invalid', 'short', 'short'],
    ['person@example.invalid', 'long passphrase test', 'mismatch'],
  ])('rejects invalid signup before contacting provider', async (email, password, confirm) => {
    const { actions, auth } = fakeClient()
    await expect(actions.register(email, password, confirm, 'Person')).rejects.toThrow()
    expect(auth.signUp).not.toHaveBeenCalled()
  })
  it.each([null, { code: 'user_already_exists' }, { code: 'email_exists' }, { code: 'unexpected_failure' }])('does not claim signup succeeded without a session (%j)', async error => {
    const { actions, auth } = fakeClient()
    auth.signUp.mockResolvedValue({ data: { session: null }, error } as never)
    await expect(actions.register('person@example.invalid', 'long passphrase test', 'long passphrase test', 'Person')).rejects.toThrow('Pendaftaran belum dapat diselesaikan.')
  })
  it.each([
    { session: {} },
    { user: { id: verified.id }, session: { access_token: 'fixture', user: { id: 'other-user' } } },
    { user: { id: verified.id, is_anonymous: true }, session: { access_token: 'fixture', user: { id: verified.id } } },
  ])('rejects malformed or mismatched signup identity', async data => {
    const { actions, auth } = fakeClient()
    auth.signUp.mockResolvedValue({ data, error: null } as never)
    await expect(actions.register('person@example.invalid', 'long passphrase test', 'long passphrase test', 'Person')).rejects.toThrow('Pendaftaran belum dapat diselesaikan.')
  })
  it('establishes login through provider and maps failures to a generic response', async () => {
    const { actions, auth } = fakeClient()
    expect((await actions.login('person@example.invalid', 'password input')).access_token).toBeTruthy()
    for (const code of ['invalid_credentials', 'email_not_confirmed']) {
      auth.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { code } } as never)
      await expect(actions.login('person@example.invalid', 'wrong input')).rejects.toThrow(loginFailure)
    }
  })
  it('uses recovery redirect, reauthentication nonce and current-device logout', async () => {
    const { actions, auth } = fakeClient()
    expect(await actions.forgot('person@example.invalid')).toContain('email pemulihan')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.invalid', { redirectTo: 'https://awasin.example/reset-password' })
    await actions.updatePassword('new long passphrase', 'new long passphrase', '123456')
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new long passphrase', nonce: '123456' })
    await actions.logout()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('does not claim password update or logout succeeded after provider errors', async () => {
    const { actions, auth } = fakeClient()
    auth.updateUser.mockResolvedValue({ error: {} } as never)
    await expect(actions.updatePassword('new long passphrase', 'new long passphrase')).rejects.toThrow()
    auth.signOut.mockResolvedValue({ error: {} } as never)
    await expect(actions.logout()).rejects.toThrow()
  })
  it('finishes device logout when SDK already cleared the session after a network error', async () => {
    const { actions, auth } = fakeClient()
    auth.signOut.mockResolvedValue({ error: { name: 'AuthRetryableFetchError' } } as never)
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never)
    await expect(actions.logout()).resolves.toBeUndefined()
    expect(sessionStorage.getItem('awasin.session-notice')).toBe('local-only')
  })
  it('distinguishes unavailable login transport from invalid credentials', async () => {
    const { actions, auth } = fakeClient()
    auth.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { name: 'AuthRetryableFetchError', status: 0 } } as never)
    await expect(actions.login('person@example.invalid', 'local passphrase')).rejects.toThrow('tidak perlu mereset')
  })
  it.each([['same_password', 'sudah menjadi'], ['weak_password', 'lebih kuat'], ['session_expired', 'berakhir'], ['reauthentication_needed', 'verifikasi ulang']])('explains password rejection %s', async (code, message) => {
    const { actions, auth } = fakeClient()
    auth.updateUser.mockResolvedValue({ error: { code } } as never)
    await expect(actions.updatePassword('new long passphrase', 'new long passphrase')).rejects.toThrow(message)
  })
})

describe('routing and session state', () => {
  it('redirects the retired verification page to login without a confirmation gate', async () => {
    const host = await render(<MemoryRouter initialEntries={['/verify-email']}><Routes><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/login" element={<p>LOGIN</p>} /></Routes></MemoryRouter>)
    expect(host.textContent).toBe('LOGIN')
  })
  it.each([verified, null])('only enters the account area after backend signup identity verification (%j)', async identity => {
    const user = { id: verified.id, is_anonymous: false }
    mock.signUp.mockResolvedValue({ data: { user, session: { access_token: 'signup-fixture', user } }, error: null })
    const refresh = vi.fn().mockResolvedValue(identity)
    const host = await render(<AuthContext.Provider value={{ identity: null, loading: false, error: '', refresh }}><MemoryRouter initialEntries={['/register']}><Routes><Route path="/register" element={<RegisterPage />} /><Route path="/dashboard" element={<p>ACCOUNT HOME</p>} /><Route path="/verify-email" element={<p>OBSOLETE GATE</p>} /></Routes></MemoryRouter></AuthContext.Provider>)
    for (const [id, value] of [['reg-fullname', 'Person'], ['reg-email', 'person@example.invalid'], ['reg-password', 'long passphrase test'], ['reg-confirm', 'long passphrase test']]) {
      await act(async () => {
        const input = host.querySelector<HTMLInputElement>(`#${id}`)!
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await act(async () => host.querySelector<HTMLInputElement>('#reg-agree')!.click())
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(refresh).toHaveBeenCalledTimes(1)
    if (identity) expect(host.textContent).toBe('ACCOUNT HOME')
    else {
      expect(host.textContent).toContain('Sesi belum dapat diverifikasi')
      expect(host.textContent).not.toContain('ACCOUNT HOME')
    }
    expect(host.textContent).not.toContain('OBSOLETE GATE')
  })
  it('routes an already verified login page through the shared identity', async () => {
    const host = await render(<AuthContext.Provider value={{ identity: verified, loading: false, error: '', refresh: async () => verified }}><MemoryRouter initialEntries={['/login']}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/dashboard" element={<p>ACCOUNT HOME</p>} /></Routes></MemoryRouter></AuthContext.Provider>)
    expect(host.textContent).toBe('ACCOUNT HOME')
  })
  it('shares an in-flight identity check between SDK events and explicit refresh', async () => {
    let refresh!: () => Promise<unknown>
    function Probe() { const auth = useAuth(); refresh = auth.refresh; return <p>{auth.identity?.email ?? 'GUEST'}</p> }
    const host = await render(<AuthProvider><Probe /></AuthProvider>)
    let finish!: (value: typeof verified) => void
    vi.mocked(fetchIdentity).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const session = { access_token: 'shared-session', user: { id: verified.id } }
    mock.getSession.mockResolvedValue({ data: { session }, error: null })
    await act(async () => authEvent('SIGNED_IN', session))
    let result!: Promise<unknown>
    await act(async () => { result = refresh() })
    expect(fetchIdentity).toHaveBeenCalledTimes(1)
    await act(async () => { finish(verified); await result })
    expect(host.textContent).toBe(verified.email)
  })
  it('rejects external/encoded/unapproved return URLs and enforces role destinations', () => {
    for (const input of ['https://evil.example', '//evil.example', '/%2f/evil', '/dashboard?redirect=evil', '/admin/unknown']) expect(safeReturnPath(input)).toBeNull()
    expect(safeReturnPath('/history')).toBe('/history')
    expect(identityDestination(verified)).toBe('/dashboard')
    expect(identityDestination({ role: 'admin', aal: 'aal1' })).toBe('/admin/dashboard')
    expect(identityDestination({ role: 'admin', aal: 'aal2' })).toBe('/admin/dashboard')
    expect(passwordError('short')).toBeTruthy()
    expect(passwordError('a'.repeat(7))).toBe('Minimal 8 karakter.')
    expect(passwordError('a'.repeat(8))).toBeNull()
    expect(passwordError('a'.repeat(128))).toBeNull()
    expect(passwordError('a'.repeat(129))).toBe('Maksimal 128 karakter.')
  })
  it.each([
    [{ loading: true, identity: null, error: '' }, false, 'Memverifikasi sesi'],
    [{ loading: false, identity: null, error: '' }, false, 'LOGIN'],
    [{ loading: false, identity: verified, error: '' }, false, 'PROTECTED'],
    [{ loading: false, identity: verified, error: '' }, true, 'ditolak'],
    [{ loading: false, identity: { ...verified, role: 'admin' }, error: '' }, true, 'PROTECTED'],
    [{ loading: false, identity: { ...verified, role: 'admin', aal: 'aal2' }, error: '' }, true, 'PROTECTED'],
  ])('guards protected content %#', async (state, admin, expected) => {
    const container = await render(<AuthContext.Provider value={{ ...state, refresh: async () => null } as never}><MemoryRouter initialEntries={['/private']}><Routes><Route path="/login" element={<p>LOGIN</p>} /><Route path="/auth/mfa" element={<p>MFA</p>} /><Route element={<ProtectedRoute admin={admin} />}><Route path="/private" element={<p>PROTECTED</p>} /></Route></Routes></MemoryRouter></AuthContext.Provider>)
    expect(container.textContent).toContain(expected)
    if (expected !== 'PROTECTED') expect(container.textContent).not.toContain('PROTECTED')
  })
  it('restores, refreshes and clears identity on SDK auth events including another tab logout', async () => {
    function Probe() { const auth = useAuth(); return <p>{auth.loading ? 'LOADING' : auth.identity?.email ?? 'GUEST'}</p> }
    mock.getSession.mockResolvedValue({ data: { session: { access_token: crypto.randomUUID() } }, error: null })
    const container = await render(<AuthProvider><Probe /></AuthProvider>)
    expect(container.textContent).toBe(verified.email)
    await act(async () => authEvent('TOKEN_REFRESHED', { access_token: crypto.randomUUID() }))
    expect(fetchIdentity).toHaveBeenCalledTimes(2)
    await act(async () => authEvent('SIGNED_OUT', null))
    expect(container.textContent).toBe('GUEST')
  })
  it('never restores a stale identity after logout races an in-flight request', async () => {
    let finish: (value: typeof verified) => void
    vi.mocked(fetchIdentity).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    function Probe() { const auth = useAuth(); return <p>{auth.identity?.email ?? 'GUEST'}</p> }
    const container = await render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => authEvent('SIGNED_IN', { access_token: crypto.randomUUID() }))
    await act(async () => authEvent('SIGNED_OUT', null))
    await act(async () => finish(verified))
    expect(container.textContent).toBe('GUEST')
  })
  it('redirects protected content after idle expiry even if tokens refresh in the background', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const token = (expiry: number) => `header.${btoa(JSON.stringify({ session_id: 'idle-test', exp: expiry }))}.signature`
    mock.getSession.mockResolvedValue({ data: { session: { access_token: token(1), user: { id: verified.id } } }, error: null })
    const host = await render(<AuthProvider><MemoryRouter initialEntries={['/private']}><Routes><Route element={<ProtectedRoute />}><Route path="/private" element={<p>PRIVATE CONTENT</p>} /></Route><Route path="/login" element={<p>LOGIN</p>} /></Routes></MemoryRouter></AuthProvider>)
    expect(host.textContent).toBe('PRIVATE CONTENT')
    await act(async () => { vi.advanceTimersByTime(59 * 60_000) })
    await act(async () => authEvent('TOKEN_REFRESHED', { access_token: token(2), user: { id: verified.id } }))
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(host.textContent).toBe('LOGIN')
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' })
    await act(async () => authEvent('TOKEN_REFRESHED', { access_token: token(3), user: { id: verified.id } }))
    expect(host.textContent).toBe('LOGIN')
    expect(mock.signOut).toHaveBeenCalledTimes(1)
  })
  it('blocks restored expired sessions before requesting protected identity', async () => {
    const token = `header.${btoa(JSON.stringify({ session_id: 'expired' }))}.signature`
    localStorage.setItem('awasin.session-activity', JSON.stringify({ session: `${verified.id}:expired`, at: Date.now() - 3_600_000, ended: false }))
    mock.getSession.mockResolvedValue({ data: { session: { access_token: token, user: { id: verified.id } } }, error: null })
    function Probe() { const auth = useAuth(); return <p>{auth.identity?.email ?? 'GUEST'}</p> }
    const host = await render(<AuthProvider><Probe /></AuthProvider>)
    expect(host.textContent).toBe('GUEST')
    expect(fetchIdentity).not.toHaveBeenCalled()
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('does not sign out a newer SDK session when an older tab expires', async () => {
    const session = (id: string) => ({ access_token: `header.${btoa(JSON.stringify({ session_id: id }))}.signature`, user: { id: verified.id } })
    localStorage.setItem('awasin.session-activity', JSON.stringify({ session: `${verified.id}:old`, at: Date.now() - 3_600_000, ended: false }))
    mock.getSession.mockResolvedValueOnce({ data: { session: session('old') }, error: null }).mockResolvedValue({ data: { session: session('new') }, error: null })
    await render(<AuthProvider><p>APP</p></AuthProvider>)
    expect(mock.signOut).not.toHaveBeenCalled()
  })
  it('preserves protected content during background session checks', async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: crypto.randomUUID() } }, error: null })
    const host = await render(<AuthProvider><MemoryRouter><Routes><Route element={<ProtectedRoute />}><Route path="/" element={<input defaultValue="unfinished form" />} /></Route></Routes></MemoryRouter></AuthProvider>)
    const input = host.querySelector('input')!
    let finish: (value: typeof verified) => void
    vi.mocked(fetchIdentity).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    await act(async () => authEvent('TOKEN_REFRESHED', { access_token: crypto.randomUUID() }))
    expect(host.querySelector('input')).toBe(input)
    expect(input.value).toBe('unfinished form')
    await act(async () => finish(verified))
    expect(host.querySelector('input')).toBe(input)
  })
  it('clears the previous account immediately while a different account is verified', async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: crypto.randomUUID(), user: { id: verified.id } } }, error: null })
    function Probe() { const auth = useAuth(); return <p>{auth.loading ? 'LOADING' : auth.identity?.email ?? 'GUEST'}</p> }
    const host = await render(<AuthProvider><Probe /></AuthProvider>)
    expect(host.textContent).toBe(verified.email)
    let finish!: (value: typeof verified) => void
    vi.mocked(fetchIdentity).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await act(async () => authEvent('SIGNED_IN', { access_token: crypto.randomUUID(), user: { id: 'second-user' } }))
    expect(host.textContent).toBe('LOADING')
    expect(host.textContent).not.toContain(verified.email)
    await act(async () => finish({ ...verified, id: 'second-user', email: 'second@example.invalid', profile: { id: 'second-user', display_name: 'Second' } }))
    expect(host.textContent).toBe('second@example.invalid')
  })
  it('removes protected identity when backend verification rejects an expired session', async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: crypto.randomUUID() } }, error: null })
    function Probe() { const auth = useAuth(); return <p>{auth.identity?.email ?? auth.error}</p> }
    const host = await render(<AuthProvider><Probe /></AuthProvider>)
    expect(host.textContent).toBe(verified.email)
    vi.mocked(fetchIdentity).mockRejectedValueOnce(new Error('Sesi tidak valid. Silakan masuk kembali.'))
    await act(async () => authEvent('TOKEN_REFRESHED', { access_token: crypto.randomUUID() }))
    expect(host.textContent).toContain('Sesi tidak valid')
    expect(host.textContent).not.toContain(verified.email)
  })
})
