import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAuthActions, accountNotice, loginFailure } from '../src/features/auth/actions'
import { identityDestination, passwordError, safeReturnPath } from '../src/features/auth/policy'
import { ProtectedRoute } from '../src/features/auth/ProtectedRoute'
import { AuthContext } from '../src/features/auth/context'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { fetchIdentity } from '../src/features/auth/identity'
import { useAuth } from '../src/features/auth/useAuth'

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), exchangeCodeForSession: vi.fn(),
}))
vi.mock('../src/features/auth/client', () => ({
  supabase: { auth: mock }, requireSupabase: () => ({ auth: mock }),
}))
vi.mock('../src/features/auth/identity', () => ({ fetchIdentity: vi.fn() }))

const verified = { id: 'local-user', email: 'local@example.invalid', role: 'user' as const, aal: 'aal1' as const, profile: { id: 'local-user', display_name: 'Test' } }
const cleanups: (() => void)[] = []
let authEvent: (event: string, session: { access_token: string } | null) => void

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mock.onAuthStateChange.mockImplementation((callback) => { authEvent = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } })
  vi.mocked(fetchIdentity).mockResolvedValue(verified)
})
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await act(async () => cleanup()) })

async function render(element: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  cleanups.push(() => { root.unmount(); container.remove() })
  await act(async () => root.render(element))
  return container
}

function fakeClient() {
  const auth = {
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: crypto.randomUUID() }, user: { email_confirmed_at: '2026-01-01' } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }), signOut: vi.fn().mockResolvedValue({ error: null }),
  }
  return { auth, actions: createAuthActions({ auth } as unknown as SupabaseClient, 'https://awasin.example') }
}

describe('account actions using mocked Supabase SDK', () => {
  it('registers with a fixed confirmation redirect and no role metadata', async () => {
    const { actions, auth } = fakeClient()
    expect(await actions.register('person@example.invalid', 'long passphrase test', 'long passphrase test', 'Person')).toBe(accountNotice)
    expect(auth.signUp.mock.calls[0][0].options).toEqual({ data: { display_name: 'Person' }, emailRedirectTo: 'https://awasin.example/verify-email' })
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
  it('does not distinguish duplicate registration from confirmation-needed', async () => {
    const { actions, auth } = fakeClient()
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { code: 'user_already_exists' } } as never)
    expect(await actions.register('person@example.invalid', 'long passphrase test', 'long passphrase test', 'Person')).toBe(accountNotice)
  })
  it('rejects configuration that skips email confirmation', async () => {
    const { actions, auth } = fakeClient()
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null } as never)
    await expect(actions.register('person@example.invalid', 'long passphrase test', 'long passphrase test', 'Person')).rejects.toThrow('konfirmasi')
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
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
})
