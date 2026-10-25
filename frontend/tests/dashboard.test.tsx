import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthContext } from '../src/features/auth/context'
import type { AuthState } from '../src/features/auth/context'
import { ProtectedRoute } from '../src/features/auth/ProtectedRoute'
import { DashboardPage } from '../src/pages/DashboardPage'
import { MainLayout } from '../src/layouts/MainLayout'
import { FloatingNavbar } from '../src/components/layout/FloatingNavbar'
import { ProfileMenu } from '../src/components/layout/ProfileMenu'
import { HomePage } from '../src/pages/HomePage'
import { AuthNotificationProvider } from '../src/features/auth/AuthNotificationProvider'

const mock = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../src/features/auth/client', () => ({ requireSupabase: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } }) }))
vi.mock('../src/features/history/api', () => ({ listHistory: vi.fn(async () => ({ items: [], next_cursor: null })) }))
vi.mock('../src/features/auth/actions', () => ({ createAuthActions: () => ({ logout: mock.logout }) }))
const identity = { id: 'fixture-user', email: 'fixture@example.invalid', role: 'user' as const, aal: 'aal1' as const, profile: { id: 'fixture-user', display_name: 'Pengguna Uji' } }
const state: AuthState = { identity, loading: false, error: '', refresh: vi.fn(async () => null) }
let cleanup: () => void

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
  Element.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn()
  mock.logout.mockResolvedValue(undefined)
})
afterEach(async () => { if (cleanup) await act(async () => cleanup()); vi.unstubAllGlobals() })

async function render(children: ReactNode, auth: AuthState = state, path = '/dashboard') {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  cleanup = () => { root.unmount(); host.remove() }
  await act(async () => root.render(<AuthContext.Provider value={auth}><MemoryRouter initialEntries={[path]}><AuthNotificationProvider>{children}</AuthNotificationProvider></MemoryRouter></AuthContext.Provider>))
  return host
}
const click = async (element: Element) => { await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })) }) }

describe('authenticated dashboard foundation', () => {
  it('opens the account dashboard instead of the public hero at the root URL for a restored session', async () => {
    const host = await render(<Routes><Route path="/" element={<HomePage />} /><Route path="/dashboard" element={<p>ACCOUNT HOME</p>} /></Routes>, state, '/')
    expect(host.textContent).toBe('ACCOUNT HOME')
  })
  it('reuses the public layout, scan workspace, education assets and footer without fake records', async () => {
    const host = await render(<Routes><Route element={<MainLayout />}><Route element={<ProtectedRoute />}><Route path="/dashboard" element={<DashboardPage />} /></Route></Route></Routes>)
    expect(host.querySelectorAll('h1')).toHaveLength(1)
    expect(host.querySelector('h1')?.textContent).toContain('Pengguna Uji')
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(6)
    expect(host.querySelectorAll('footer')).toHaveLength(1)
    expect(host.querySelectorAll('.article-card')).toHaveLength(4)
    expect(host.querySelector('video')).toBeNull() // Reduced motion is enabled in this fixture.
    expect(host.textContent).toContain('Belum ada pemeriksaan tersimpan.')
    expect(host.textContent).toContain('Konten pemeriksaan tidak disimpan otomatis.')
    expect([...host.querySelectorAll('.desktop-nav a')].map(a => a.textContent)).toEqual(['Beranda', 'Periksa', 'Riwayat', 'Edukasi', 'Feedback'])
    const tabs = [...host.querySelectorAll('[role="tab"]')]
    for (const tab of tabs) {
      await click(tab)
      expect(tab.getAttribute('aria-selected')).toBe('true')
      expect(host.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(tab.id)
    }
    expect(host.querySelector('input[type="file"]')?.getAttribute('accept')).toContain('video/mp4')
  })
  it('uses a generic greeting when the verified display name is empty', async () => {
    const host = await render(<DashboardPage />, { ...state, identity: { ...identity, profile: { ...identity.profile, display_name: '  ' } } })
    expect(host.querySelector('h1')?.textContent).toBe('Selamat datang kembali.')
    expect(host.textContent).not.toContain('undefined')
  })
  it.each([{ loading: true, identity: null, error: '' }, { loading: false, identity: null, error: '' }, { loading: false, identity: null, error: 'Sesi tidak valid.' }])('does not render account data for unresolved, missing or revoked identity %#', async (auth) => {
    function LoginDestination() { const { state: entry } = useLocation(); return <p>LOGIN {entry?.returnTo}</p> }
    const host = await render(<Routes><Route element={<ProtectedRoute />}><Route path="/dashboard" element={<DashboardPage />} /></Route><Route path="/login" element={<LoginDestination />} /></Routes>, { ...auth, refresh: state.refresh })
    expect(host.querySelector('.dashboard-page')).toBeNull()
    expect(host.textContent).not.toContain('Pengguna Uji')
    if (!auth.loading && !auth.error) expect(host.textContent).toContain('LOGIN /dashboard')
  })
  it('preserves public navigation, guest scanning and original hero', async () => {
    const host = await render(<><FloatingNavbar /><HomePage /></>, { ...state, identity: null }, '/')
    expect(host.querySelector('h1')?.textContent).toContain('Jangan asal klik.')
    expect(host.querySelector('a[aria-label="Masuk ke akun AWASIN"]')).not.toBeNull()
    expect(host.querySelector('[aria-label="Menu akun"]')).toBeNull()
    expect([...host.querySelectorAll('.desktop-nav a')].map(a => a.textContent)).toEqual(['Beranda', 'Periksa', 'Edukasi', 'Feedback'])
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(6)
  })
})

describe('account disclosure and real logout integration', () => {
  it('opens with keyboard and closes with Escape while returning focus', async () => {
    const host = await render(<ProfileMenu />)
    const trigger = host.querySelector('button')!
    await act(async () => { trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('#profile-actions')?.textContent).toContain(identity.email)
    expect(host.querySelector('#profile-actions')?.textContent).not.toMatch(/Privasi & Data|Administrator/)
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(host.querySelector('#profile-actions')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
  it('closes on outside interaction and navigation', async () => {
    const host = await render(<Routes><Route path="/dashboard" element={<FloatingNavbar />} /><Route path="/settings" element={<p>SETTINGS</p>} /></Routes>)
    await click(host.querySelector('[aria-label="Menu akun"]')!)
    await act(async () => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(host.querySelector('#profile-actions')).toBeNull()
    await click(host.querySelector('[aria-label="Menu akun"]')!)
    await click(host.querySelector('#profile-actions a')!)
    expect(host.textContent).toBe('SETTINGS')
  })
  it('opens authenticated mobile links using the existing disclosure', async () => {
    const host = await render(<FloatingNavbar />)
    await click(host.querySelector('.menu-trigger')!)
    expect([...host.querySelectorAll('#mobile-navigation a')].map(a => a.textContent)).toEqual(['Beranda', 'Periksa', 'Riwayat', 'Edukasi', 'Feedback'])
    expect(host.querySelector('#mobile-navigation a[href="/history"]')).not.toBeNull()
    await click(host.querySelector('[aria-label="Menu akun"]')!)
    expect(host.querySelector('#mobile-navigation')).toBeNull()
    expect(host.querySelector('#profile-actions')).not.toBeNull()
  })
  it('awaits sign-out and refresh before navigating to public home', async () => {
    const refresh = vi.fn(async () => null)
    const host = await render(<Routes><Route path="/dashboard" element={<ProfileMenu />} /><Route path="/" element={<p>PUBLIC</p>} /></Routes>, { ...state, refresh })
    await click(host.querySelector('button')!)
    await click(host.querySelector('#profile-actions button')!)
    expect(mock.logout).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('PUBLIC')
  })
  it('reports failed sign-out and keeps account actions available', async () => {
    mock.logout.mockRejectedValueOnce(new Error('Unavailable'))
    const host = await render(<ProfileMenu />)
    await click(host.querySelector('button')!)
    await click(host.querySelector('#profile-actions button')!)
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Belum berhasil keluar')
    expect(host.querySelector('#profile-actions')).not.toBeNull()
  })
})
