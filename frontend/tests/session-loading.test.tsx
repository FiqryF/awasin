import { afterEach, beforeEach, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthContext, type AuthState } from '../src/features/auth/context'
import { AuthSessionGate } from '../src/features/auth/AuthSessionGate'
import { SessionLoading } from '../src/features/auth/SessionLoading'

let cleanup: (() => void) | undefined
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
afterEach(async () => { if (cleanup) await act(async () => cleanup?.()); cleanup = undefined })
async function fixture() {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  cleanup = () => { root.unmount(); host.remove() }
  const draw = async (auth: Omit<AuthState, 'refresh'>) => {
    await act(async () => root.render(<AuthContext.Provider value={{ ...auth, refresh: async () => null }}><AuthSessionGate><header>Navigation</header><main><input defaultValue="Unfinished form" /></main><footer>Footer</footer></AuthSessionGate></AuthContext.Provider>))
  }
  return { host, draw }
}
it('shows only a centered session loader while restoration is pending, then reveals the page', async () => {
  const { host, draw } = await fixture()
  await draw({ loading: true, identity: null, error: '' })
  expect(host.querySelector('.session-loading[aria-busy="true"]')).not.toBeNull()
  expect(host.querySelector('.session-loading-spinner')).not.toBeNull()
  expect(host.querySelector('output')?.textContent).toBe('Memverifikasi sesi…')
  expect(host.querySelector('header, footer, input')).toBeNull()
  await draw({ loading: false, identity: null, error: '' })
  expect(host.querySelector('.session-loading')).toBeNull()
  expect(host.querySelector('header')).not.toBeNull()
  expect(host.querySelector('footer')).not.toBeNull()
})
it('keeps existing content mounted during checks of an already verified account', async () => {
  const { host, draw } = await fixture()
  const identity = { id: 'fixture', email: 'fixture@example.invalid', role: 'user' as const, aal: 'aal1' as const, profile: { id: 'fixture', display_name: 'Fixture' } }
  await draw({ loading: false, identity, error: '' })
  const input = host.querySelector('input')!
  await draw({ loading: true, identity, error: '' })
  expect(host.querySelector('input')).toBe(input)
  expect(host.querySelector('.session-loading')).toBeNull()
})
it('does not hide a resolved error behind an endless loading screen', async () => {
  const { host, draw } = await fixture()
  await draw({ loading: false, identity: null, error: 'Verification unavailable' })
  expect(host.querySelector('.session-loading')).toBeNull()
})
it('uses an accurate label for lazy page loading', async () => {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host); cleanup = () => { root.unmount(); host.remove() }
  await act(async () => root.render(<SessionLoading label="Memuat halaman…" />))
  expect(host.querySelector('output')?.textContent).toBe('Memuat halaman…')
})
