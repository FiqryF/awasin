import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '../src/features/auth/context'
import type { Identity } from '../src/features/auth/identity'
import { ScanPanel } from '../src/features/scan/ScanPanel'

const mock = vi.hoisted(() => ({ decodeQr: vi.fn(), getSession: vi.fn() }))
vi.mock('../src/features/scan/decodeQr', async original => ({ ...await original<object>(), decodeQr: mock.decodeQr }))
vi.mock('../src/features/auth/client', () => ({ requireSupabase: () => ({ auth: { getSession: mock.getSession } }) }))
let cleanup: (() => void) | undefined
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  URL.createObjectURL = vi.fn(() => 'blob:local-test')
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('fetch', vi.fn())
  window.open = vi.fn()
})
afterEach(async () => { if (cleanup) await act(async () => cleanup?.()); cleanup = undefined; vi.unstubAllGlobals() })
async function mount(mode: string, identity: Identity | null = null) {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<MemoryRouter initialEntries={[`/dashboard?mode=${mode}#periksa`]}>
    <AuthContext.Provider value={{ identity, loading: false, error: '', refresh: async () => null }}>
      <ScanPanel />
    </AuthContext.Provider>
  </MemoryRouter>))
  cleanup = () => { root.unmount(); host.remove() }
  return host
}
async function submit(host: HTMLElement) {
  await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}
async function chooseFile(host: HTMLElement, mode: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File(['local fixture only'], mode === 'video' ? 'test.mp4' : 'test.png', { type: mode === 'video' ? 'video/mp4' : 'image/png' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}
function unavailable(mode: string) {
  return new Response(JSON.stringify({
    analysis_id: 'fixture', request_id: 'fixture', mode, status: 'unavailable', risk: 'unknown',
    explanation: 'Analisis untuk jenis konten ini belum tersedia.', evidence: [],
    limitations: ['Validasi input tidak menghasilkan penilaian risiko.'], history_eligible: false,
  }))
}
async function enterText(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
it.each(['link', 'message', 'website', 'qr', 'image', 'video'])('preselects %s from the URL without reloading', async mode => {
  const host = await mount(mode)
  expect(host.querySelector('[aria-selected="true"]')?.id).toBe(`tab-${mode}`)
  expect(host.querySelector('[role="tabpanel"]')?.id).toBe(`panel-${mode}`)
})
it.each(['link', 'message', 'website', 'image', 'video'])('does not fabricate or save analysis after valid %s input', async mode => {
  vi.mocked(fetch).mockResolvedValueOnce(unavailable(mode))
  const host = await mount(mode)
  const input = host.querySelector<HTMLInputElement|HTMLTextAreaElement>('#scan-text')
  if (input) {
    const value = mode === 'message' ? 'Pesan fixture yang cukup panjang' : mode === 'website' ? 'example.com' : 'https://example.com'
    await enterText(input, value)
  } else await chooseFile(host, mode)
  await submit(host)
  expect(host.textContent).toContain('Analisis untuk jenis konten ini belum tersedia.')
  expect(host.textContent).not.toContain('Simpan ke Riwayat')
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, options] = vi.mocked(fetch).mock.calls[0]
  expect(url).toMatch(input ? /\/api\/v1\/analysis$/ : new RegExp(`/api/v1/analysis/media/${mode}$`))
  expect(options?.method).toBe('POST')
  expect(new Headers(options?.headers).has('Authorization')).toBe(false)
  if (options?.body instanceof FormData) expect((options.body.get('file') as File).name).toBe('upload')
  expect(window.open).not.toHaveBeenCalled()
})
it('shows decoded QR text safely before user-selected URL inspection', async () => {
  mock.decodeQr.mockResolvedValueOnce('https://example.com/?test=local')
  vi.mocked(fetch).mockResolvedValueOnce(unavailable('qr'))
  const host = await mount('qr')
  await chooseFile(host, 'qr'); await submit(host)
  expect(host.querySelector('.qr-decoded pre')?.textContent).toBe('https://example.com/?test=local')
  expect(host.querySelector('output')?.textContent).toBe('')
  expect(host.querySelector('.qr-decoded a')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  await act(async () => { host.querySelector('.qr-decoded button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  expect(host.textContent).toContain('Analisis untuk jenis konten ini belum tersedia.')
  const options = vi.mocked(fetch).mock.calls[0][1]
  expect(JSON.parse(String(options?.body))).toEqual({ mode: 'qr', payload: 'https://example.com/?test=local' })
  expect(window.open).not.toHaveBeenCalled()
})

it('combines screenshot and text without sending the local file name', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(unavailable('message'))
  const host = await mount('message')
  await enterText(host.querySelector('textarea')!, 'Pesan uji')
  await chooseFile(host, 'message')
  await submit(host)
  const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData
  expect(JSON.parse(String(body.get('metadata')))).toEqual({ mode: 'message', text: 'Pesan uji' })
  expect((body.get('file') as File).name).toBe('upload')
})

it('aborts pending analysis after an edit and ignores its late result', async () => {
  let finish!: (result: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const host = await mount('link')
  const input = host.querySelector<HTMLInputElement>('#scan-text')!
  await enterText(input, 'https://example.com')
  await submit(host)
  expect(host.querySelector('output')?.textContent).toContain('Menghubungi')
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
  await enterText(input, 'https://example.org')
  expect(signal?.aborted).toBe(true)
  await act(async () => finish(unavailable('link')))
  expect(host.querySelector('output')?.textContent).toBe('')
})

it.each([401, 413, 422, 429, 503])('announces HTTP %i errors without rendering the response body', async status => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('internal-private-data', { status }))
  const host = await mount('link')
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.com')
  await submit(host)
  expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy()
  expect(host.textContent).not.toContain('internal-private-data')
  expect(host.querySelector('output')?.textContent).toBe('')
})

it.each(['fixture-owner', 'different-user'])('uses the session only when it belongs to the active account (%s)', async sessionId => {
  const identity: Identity = {
    id: 'fixture-owner', email: 'fixture@example.invalid', aal: 'aal1', role: 'user',
    profile: { id: 'fixture-owner', display_name: 'Fixture' },
  }
  mock.getSession.mockResolvedValueOnce({ data: { session: { user: { id: sessionId }, access_token: 'fixture-token' } }, error: null })
  vi.mocked(fetch).mockResolvedValueOnce(unavailable('link'))
  const host = await mount('link', identity)
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.com')
  await submit(host)
  if (sessionId === identity.id) {
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer fixture-token')
  } else {
    expect(fetch).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Sesi berakhir')
  }
})

it('announces a disconnected API and permits a retry', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fixture network error')).mockResolvedValueOnce(unavailable('link'))
  const host = await mount('link')
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.com')
  await submit(host)
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('tidak dapat dihubungi')
  await submit(host)
  expect(host.querySelector('[role="alert"]')).toBeNull()
  expect(host.querySelector('output')?.textContent).toContain('belum tersedia')
})
it('renders non-URL QR contents as text and handles unreadable QR errors', async () => {
  mock.decodeQr.mockResolvedValueOnce('<img src=x onerror=alert(1)>')
  const host = await mount('qr')
  await chooseFile(host, 'qr'); await submit(host)
  expect(host.querySelector('.qr-decoded pre')?.textContent).toContain('<img')
  expect(host.querySelector('.qr-decoded img')).toBeNull()
  expect(host.querySelector('.qr-decoded button')).toBeNull()
  mock.decodeQr.mockRejectedValueOnce(new Error('QR Code tidak ditemukan.'))
  await submit(host)
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('QR Code tidak ditemukan.')
})
