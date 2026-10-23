import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { ResetPasswordPage } from '../src/pages/auth/ResetPasswordPage'
import { rememberPasswordSetup, restorePasswordSetup } from '../src/features/auth/passwordSetup'

const mock = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), verifyOtp: vi.fn() }))
vi.mock('../src/features/auth/client', () => ({ requireSupabase: () => ({ auth: mock }) }))
const user = { id: 'test-user', email_confirmed_at: '2026-01-01' }
let cleanup: (() => void) | undefined
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) })
  sessionStorage.clear()
  window.history.replaceState(null, '', '/reset-password')
  mock.getUser.mockResolvedValue({ data: { user }, error: null })
  mock.updateUser.mockResolvedValue({ error: null })
  mock.signOut.mockResolvedValue({ error: null })
  mock.verifyOtp.mockResolvedValue({ data: { user, session: {} }, error: null })
})
afterEach(async () => { if (cleanup) await act(async () => { cleanup!(); cleanup = undefined }) })

async function page() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  cleanup = () => { root.unmount(); host.remove() }
  await act(async () => root.render(<StrictMode><MemoryRouter><ResetPasswordPage /></MemoryRouter></StrictMode>))
  return host
}

async function submitPassword(host: HTMLElement) {
  await act(async () => {
    for (const id of ['reset-password', 'reset-confirm']) {
      const input = host.querySelector<HTMLInputElement>(`#${id}`)!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'local test passphrase')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
}

it('restores verified setup after refresh and refuses expired or different-user progress', async () => {
  rememberPasswordSetup(user.id)
  const host = await page()
  expect(host.querySelector('#reset-password')).not.toBeNull()
  mock.getUser.mockResolvedValue({ data: { user: { ...user, id: 'different-user' } }, error: null })
  expect(await restorePasswordSetup()).toBeNull()
  sessionStorage.setItem('awasin.password-setup', JSON.stringify({ userId: user.id, expiresAt: 0, completed: false }))
  expect(await restorePasswordSetup()).toBeNull()
})

it('exchanges an invitation once under StrictMode and then restores without reusing its token', async () => {
  window.history.replaceState(null, '', '/reset-password?token_hash=local-only-invitation&type=invite')
  const host = await page()
  expect(mock.verifyOtp).toHaveBeenCalledTimes(1)
  expect(host.querySelector('#reset-password')).not.toBeNull()
  expect(window.location.search).toBe('')
  expect(await restorePasswordSetup()).toBe('ready')
})

it.each([null, { code: 'same_password' }])('finishes setup for a saved or already active password (%j)', async (error) => {
  rememberPasswordSetup(user.id)
  mock.updateUser.mockResolvedValue({ error })
  const host = await page()
  await submitPassword(host)
  expect(host.querySelector('form')).toBeNull()
  expect(host.textContent).toContain('Silakan masuk')
  expect(host.querySelector('a[href="/login"]')?.textContent).toContain('Masuk dengan')
  expect(await restorePasswordSetup()).toBe('completed')
})

it('keeps password success separate from failed logout', async () => {
  rememberPasswordSetup(user.id)
  mock.signOut.mockResolvedValue({ error: { code: 'network_error' } })
  const host = await page()
  await submitPassword(host)
  expect(host.textContent).toContain('Kata sandi berhasil disimpan')
  expect(host.textContent).toContain('Sesi perangkat belum berhasil ditutup')
  expect(host.querySelector('form')).toBeNull()
})

it('shows rejected password as an alert and preserves the verified setup', async () => {
  rememberPasswordSetup(user.id)
  mock.updateUser.mockResolvedValue({ error: { code: 'weak_password' } })
  const host = await page()
  await submitPassword(host)
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('lebih kuat')
  expect(host.querySelector('#reset-password')).not.toBeNull()
  expect(mock.signOut).not.toHaveBeenCalled()
})
