import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { ScanPanel } from '../src/features/scan/ScanPanel'

const mock = vi.hoisted(() => ({ decodeQr: vi.fn() }))
vi.mock('../src/features/scan/decodeQr', async original => ({ ...await original<object>(), decodeQr: mock.decodeQr }))
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
async function mount(mode: string) {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<MemoryRouter initialEntries={[`/dashboard?mode=${mode}#periksa`]}><ScanPanel /></MemoryRouter>))
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
it.each(['link', 'message', 'website', 'qr', 'image', 'video'])('preselects %s from the URL without reloading', async mode => {
  const host = await mount(mode)
  expect(host.querySelector('[aria-selected="true"]')?.id).toBe(`tab-${mode}`)
  expect(host.querySelector('[role="tabpanel"]')?.id).toBe(`panel-${mode}`)
})
it.each(['link', 'message', 'website', 'image', 'video'])('does not fabricate or save analysis after valid %s input', async mode => {
  const host = await mount(mode)
  const input = host.querySelector<HTMLInputElement|HTMLTextAreaElement>('#scan-text')
  if (input) {
    const type = mode === 'message' ? HTMLTextAreaElement : HTMLInputElement
    const value = mode === 'message' ? 'Pesan fixture yang cukup panjang' : mode === 'website' ? 'example.com' : 'https://example.com'
    await act(async () => { Object.getOwnPropertyDescriptor(type.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
  } else await chooseFile(host, mode)
  await submit(host)
  expect(host.textContent).toContain('Analisis untuk jenis konten ini belum tersedia.')
  expect(host.textContent).not.toContain('Simpan ke Riwayat')
  expect(fetch).not.toHaveBeenCalled()
  expect(window.open).not.toHaveBeenCalled()
})
it('shows decoded QR text safely before user-selected URL inspection', async () => {
  mock.decodeQr.mockResolvedValueOnce('https://example.com/?test=local')
  const host = await mount('qr')
  await chooseFile(host, 'qr'); await submit(host)
  expect(host.querySelector('.qr-decoded pre')?.textContent).toBe('https://example.com/?test=local')
  expect(host.querySelector('output')).toBeNull()
  expect(host.querySelector('.qr-decoded a')).toBeNull()
  await act(async () => { host.querySelector('.qr-decoded button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  expect(host.textContent).toContain('Analisis untuk jenis konten ini belum tersedia.')
  expect(fetch).not.toHaveBeenCalled()
  expect(window.open).not.toHaveBeenCalled()
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
