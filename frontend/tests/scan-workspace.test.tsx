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
afterEach(async () => { if (cleanup) await act(async () => cleanup?.()); cleanup = undefined; vi.unstubAllGlobals(); vi.unstubAllEnvs() })
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
  const visibleMode = mode === 'website' ? 'link' : mode
  expect(host.querySelector('[aria-selected="true"]')?.id).toBe(`tab-${visibleMode}`)
  expect(host.querySelector('[role="tabpanel"]')?.id).toBe(`panel-${visibleMode}`)
  expect(host.querySelectorAll('[role="tab"]')).toHaveLength(5)
  expect(host.querySelector('#tab-website')).toBeNull()
})

it('moves focus and selection from the merged tab using the arrow key', async () => {
  const host = await mount('website')
  const tab = host.querySelector<HTMLButtonElement>('#tab-link')!
  expect(tab.textContent).toBe('Link & Website')
  tab.focus()
  await act(async () => tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(document.activeElement?.id).toBe('tab-message')
  expect(host.querySelector('#tab-message')?.getAttribute('aria-selected')).toBe('true')
})

const aiTicket = 'a'.repeat(43)
function aiScan(ai: { status: string; ticket?: string } | null = null) {
  return new Response(JSON.stringify({
    analysis_id: 'fixture', request_id: 'fixture', mode: 'link', status: 'completed', risk: 'medium',
    explanation: 'Temuan AWASIN tetap terlihat.', evidence: [], limitations: [], history_eligible: false, ai,
    url_report: {
      display_url: 'https://example.org', registered_domain: 'example.org', scheme_assumed: false, components_hidden: false,
      threat_status: 'not_requested', threat_checked_at: null, threat_provider: 'Google Safe Browsing',
      identity_status: 'insufficient_evidence', recommendations: [],
    },
  }))
}

function fullInspectionOption(host: HTMLElement) {
  return host.querySelector<HTMLInputElement>('input[aria-describedby="scan-consent-help"]')!
}

it('loads the validated Nemotron fallback after rendering the verdict and consumes consent once', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockResolvedValueOnce(aiScan({ status: 'pending', ticket: aiTicket }))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const host = await mount('link')
  const input = host.querySelector<HTMLInputElement>('#scan-text')!
  await enterText(input, 'https://example.org/')
  const consent = fullInspectionOption(host)
  expect(consent.checked).toBe(false)
  expect(consent.labels?.[0].textContent).toBe('Izinkan pemeriksaan lengkap')
  consent.focus()
  expect(document.activeElement).toBe(consent)
  await act(async () => consent.click())
  await submit(host)
  expect(host.querySelector('.url-result-card h4')?.textContent).toBe('Waspada — Risiko sedang')
  expect(host.querySelector('.url-result-card')?.textContent).toContain('Menunggu analisis Mistral')
  expect(consent.checked).toBe(false)
  const [scan, ai] = vi.mocked(fetch).mock.calls
  expect(JSON.parse(String(scan[1]?.body))).toEqual({
    mode: 'link', url: 'https://example.org/', threat_lookup_consent: true, enhanced_lookup_consent: true,
    url_ai_consent: true, openrouter_fallback_consent: true,
  })
  expect(JSON.parse(String(ai[1]?.body))).toEqual({ ticket: aiTicket, consent: true })
  await act(async () => finish(Response.json({
    status: 'completed', analyst: 'nemotron', risk: 'high', summary: 'Ringkasan berdasarkan bukti.',
    findings: [], limitations: [], recommendations: [],
  })))
  const card = host.querySelector('.url-result-card')!
  expect(card.textContent).toContain('Penilaian Nemotron tervalidasi')
  expect(card.textContent).toContain('Ringkasan berdasarkan bukti.')
  expect(card.querySelector('h4')?.textContent).toBe('Berbahaya — Risiko tinggi')
  expect(host.querySelector('.url-report')?.children).toHaveLength(1)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([
  ['unknown', 'Belum dapat dipastikan'], ['low', 'Aman'],
  ['medium', 'Waspada — Risiko sedang'], ['high', 'Berbahaya — Risiko tinggi'],
])('shows the final AI verdict %s in a single card', async (risk, label) => {
  vi.mocked(fetch).mockResolvedValueOnce(aiScan({ status: 'pending', ticket: aiTicket }))
    .mockResolvedValueOnce(Response.json({
      status: 'completed', risk, summary: 'Ringkasan AI. Temuan ini belum memastikan bahwa tautan tersebut merupakan penipuan.',
      findings: [], limitations: [], recommendations: [],
    }))
  const host = await mount('link')
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.org/')
  await act(async () => fullInspectionOption(host).click())
  await submit(host)
  const card = host.querySelector('.url-result-card')!
  expect(card.getAttribute('data-risk')).toBe(risk)
  expect(card.querySelector('h4')?.textContent).toBe(label)
  expect(card.textContent).toContain('Ringkasan AI.')
  expect(card.textContent).not.toContain('Temuan ini belum memastikan')
})

it.each(['validation_failed', 'timeout', 'rate_limited', 'unavailable', 'disabled'])('keeps the local result when AI is %s', async status => {
  vi.mocked(fetch).mockResolvedValueOnce(aiScan(status === 'disabled' ? { status } : { status: 'pending', ticket: aiTicket }))
  if (status !== 'disabled') vi.mocked(fetch).mockResolvedValueOnce(Response.json({ status }))
  const host = await mount('link')
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.org/')
  await act(async () => fullInspectionOption(host).click())
  await submit(host)
  expect(host.querySelector('.url-result-card')?.textContent).toContain(status === 'rate_limited'
    ? 'Batas permintaan AI tercapai' : 'Analisis AI belum menghasilkan keputusan')
  expect(host.querySelector('.url-result-card h4')?.textContent).toBe('Waspada — Risiko sedang')
  expect(fetch).toHaveBeenCalledTimes(status === 'disabled' ? 1 : 2)
})

it('cancels stale AI results on edit and sends no AI request for the next unconsented scan', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockResolvedValueOnce(aiScan({ status: 'pending', ticket: aiTicket }))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(aiScan())
  const host = await mount('link')
  const input = host.querySelector<HTMLInputElement>('#scan-text')!
  await enterText(input, 'https://example.org/')
  await act(async () => fullInspectionOption(host).click())
  await submit(host)
  const oldSignal = vi.mocked(fetch).mock.calls[1][1]?.signal
  await enterText(input, 'https://example.com/')
  expect(oldSignal?.aborted).toBe(true)
  expect(fullInspectionOption(host).checked).toBe(false)
  await submit(host)
  await act(async () => finish(new Response(JSON.stringify({ status: 'validation_failed' }))))
  expect(host.querySelector('.url-ai-report')).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(3)
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2][1]?.body))).toEqual({ mode: 'link', url: 'https://example.com/' })
})

it('defaults to local inspection and presents one optional consent checkbox', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(aiScan())
  const host = await mount('link')
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.org/')
  expect(fullInspectionOption(host).checked).toBe(false)
  expect(host.querySelector('#panel-link details')).toBeNull()
  expect(host.textContent).toContain('AWASIN bisa saja salah.')
  await submit(host)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ mode: 'link', url: 'https://example.org/' })
})

it.each([
  ['timeout', 'Provider melewati batas waktu'],
  ['no_match', 'Tidak ditemukan dalam daftar ancaman yang diperiksa'],
  ['match', 'Cocok dengan daftar ancaman'],
  ['unsupported', 'Alamat ini tidak didukung untuk lookup eksternal'],
])('renders structure evidence and Safe Browsing state %s', async (status, providerText) => {
  const matched = status === 'match'
  const vtStatus = matched ? 'found' : status === 'timeout' ? 'rate_limited' : 'not_found'
  const baseCheck = { observed_at: null, specificity: null, verdict: null, freshness: null,
    counts: {}, categories: [], details: [], limitations: [], record_id: null }
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
    analysis_id: 'fixture', request_id: 'fixture', mode: 'link', status: matched ? 'completed' : 'partial', risk: matched ? 'high' : 'unknown',
    explanation: 'Ada indikator pada alamat yang layak ditinjau.',
    evidence: [{ id: 'finding', code: 'account_path', kind: 'structure', explanation: 'Path menyebut login.',
      source: 'Struktur URL', indicator: null, limitations: ['Temuan ini belum cukup untuk menilai risiko.'] },
    ...(matched ? [{ id: 'threat', code: 'threat_match', kind: 'intelligence', explanation: 'Kecocokan daftar ancaman.',
      source: 'Google Safe Browsing', indicator: 'SOCIAL_ENGINEERING', limitations: [] }] : [])],
    limitations: ['Konten halaman website tidak diperiksa.', 'Lookup eksternal belum tersedia.'],
    history_eligible: false,
    url_report: {
      display_url: 'https://example.org', registered_domain: 'example.org', scheme_assumed: false, components_hidden: true,
      threat_status: status, threat_checked_at: status === 'timeout' ? null : '2026-11-11T12:00:00Z', threat_provider: 'Google Safe Browsing',
      identity_status: 'insufficient_evidence', recommendations: ['Buka layanan dari kanal resmi.'],
      supplementary_checks: [
        { ...baseCheck, provider: 'VirusTotal', status: vtStatus,
          ...(matched ? { observed_at: '2026-11-10T12:00:00Z', specificity: 'exact_url', freshness: 'recent',
            verdict: 'malicious', counts: { malicious: 3, suspicious: 1 } } : {}) },
        { ...baseCheck, provider: 'VirusTotal AI', status: 'found', observed_at: '2026-11-10T12:00:00Z',
          specificity: 'exact_url', freshness: 'recent', verdict: matched ? 'malicious' : 'no_detection' },
        { ...baseCheck, provider: 'urlscan.io', status: 'found', observed_at: '2025-11-11T12:00:00Z',
          specificity: 'related_domain', verdict: 'unknown', freshness: 'stale' },
        { ...baseCheck, provider: 'DNS', status: 'found', details: ['A 93.184.216.34'] },
        { ...baseCheck, provider: 'RDAP', status: status === 'unsupported' ? 'skipped' : 'unavailable' },
      ],
    },
  })))
  const host = await mount('link')
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.org/login')
  const consent = fullInspectionOption(host)
  expect(consent.checked).toBe(false)
  await act(async () => consent.click())
  await submit(host)
  const [, request] = vi.mocked(fetch).mock.calls[0]
  expect(JSON.parse(String(request?.body)).threat_lookup_consent).toBe(true)
  expect(JSON.parse(String(request?.body)).enhanced_lookup_consent).toBe(true)
  const report = host.querySelector('.url-report')!
  expect(report, host.textContent ?? '').not.toBeNull()
  expect(report.getAttribute('aria-label')).toBe('Hasil Link & Website Inspector')
  expect(report.children).toHaveLength(1)
  expect(report.textContent).toContain(matched ? 'Ancaman ditemukan' : 'Belum dapat dipastikan')
  const coverage = { match: '5 dari 6', no_match: '5 dari 6', timeout: '3 dari 6', unsupported: '4 dari 4' }
  expect(report.querySelector('.url-result-card')?.textContent).toContain(`${coverage[status as keyof typeof coverage]} pemeriksaan sumber luar selesai.`)
  expect(consent.checked).toBe(false)
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.net/')
  expect(host.querySelector('.url-report')).toBeNull()
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
  if (mode === 'link' || mode === 'website') expect(JSON.parse(String(options?.body))).not.toHaveProperty('enhanced_lookup_consent')
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

it.each([[false, 'saved', false], [true, 'saved', true], [true, 'unavailable', false]])('shows saved message history only with consent and a receipt (%s, %s)', async (consent, status, saved) => {
  const identity: Identity = { id: 'fixture-owner', email: 'fixture@example.invalid', aal: 'aal1', role: 'user', profile: { id: 'fixture-owner', display_name: 'Fixture' } }
  mock.getSession.mockResolvedValueOnce({ data: { session: { user: { id: identity.id }, access_token: 'fixture-token' } }, error: null })
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...await unavailable('message').json(), history_status: status,
    message_report: { ocr_status: 'not_requested', ai_status: 'invalid_response', links: [], recommendations: [] },
  }))
  const host = await mount('message', identity)
  await enterText(host.querySelector('textarea')!, 'Pesan sintetis untuk tes')
  const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'Simpan ringkasan ke Riwayat')!
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
  if (consent) await act(async () => save.click())
  expect(save.getAttribute('aria-pressed')).toBe(String(consent))
  await submit(host)
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).history_consent).toBe(consent ? true : undefined)
  expect(host.textContent?.includes('Tersimpan di Riwayat.')).toBe(saved)
  expect(host.textContent).toContain('Hasil pemeriksaan AWASIN · Analisis AI tidak lolos validasi')
})

it.each([
  ['completed', 'completed', 'Bukti belum cukup'],
  ['completed', 'invalid_response', 'Analisis AI gagal'],
  ['completed', 'timeout', 'Analisis AI gagal'],
  ['completed', 'rate_limited', 'Analisis AI gagal'],
  ['truncated', 'completed', 'Teks screenshot perlu diperiksa'],
  ['failed', 'not_requested', 'Teks screenshot perlu diperiksa'],
])('distinguishes unknown OCR and AI outcomes (%s, %s)', async (ocrStatus, aiStatus, title) => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...await unavailable('message').json(),
    message_report: { ocr_status: ocrStatus, ai_status: aiStatus, links: [], recommendations: [] },
  }))
  const host = await mount('message')
  await act(async () => host.querySelectorAll<HTMLInputElement>('input[name="message-mode"]')[1].click())
  await chooseFile(host, 'message')
  await submit(host)
  expect(host.querySelector('.url-result-card h4')?.textContent).toBe(title)
})

it('uploads screenshots without the original file name and offers OCR correction', async () => {
  const base = await unavailable('message').json()
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...base, message_report: {
    ocr_status: 'low_confidence', ai_status: 'not_requested', links: [], recommendations: [], ocr_preview: 'Teks yang sudah disaring',
  } }))
  const host = await mount('message')
  await act(async () => host.querySelectorAll<HTMLInputElement>('input[name="message-mode"]')[1].click())
  await chooseFile(host, 'message')
  await submit(host)
  const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData
  expect(JSON.parse(String(body.get('metadata')))).toEqual({ mode: 'message' })
  expect((body.get('file') as File).name).toBe('upload')
  expect(host.textContent).toContain('Pembacaan OCR kurang jelas.')
  const edit = [...host.querySelectorAll('button')].find(button => button.textContent === 'Koreksi di mode teks')!
  await act(async () => edit.click())
  expect(host.querySelector('textarea')?.value).toBe('Teks yang sudah disaring')
})

it('uses one consent for screenshot checks and includes the link result in the summary card', async () => {
  const base = await unavailable('message').json()
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...base, message_report: {
    ocr_status: 'completed', ai_status: 'not_requested',
    links: [{ host: 'example.org', status: 'no_match', risk: 'medium' }], recommendations: [],
  } }))
  const host = await mount('message')
  await act(async () => host.querySelectorAll<HTMLInputElement>('input[name="message-mode"]')[1].click())
  await chooseFile(host, 'message')
  const label = [...host.querySelectorAll('label')].find(item => item.textContent?.includes('Izinkan pemeriksaan lengkap'))!
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
  await act(async () => label.querySelector('input')!.click())
  await submit(host)
  const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData
  expect(JSON.parse(String(body.get('metadata')))).toEqual({
    mode: 'message', message_ai_consent: true, message_openrouter_consent: true,
    message_link_consent: true, message_link_enhanced_consent: true,
  })
  expect(host.querySelector('.url-result-card li')?.textContent).toContain('example.org · Waspada')
})

it('requests full message inspection with one checkbox and labels the Nemotron result', async () => {
  const base = await unavailable('message').json()
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...base, risk: 'low', message_report: {
    ocr_status: 'not_requested', ai_status: 'completed', analyst: 'nemotron', links: [], recommendations: [],
  } }))
  const host = await mount('message')
  await enterText(host.querySelector('textarea')!, 'Pesan fixture untuk Nemotron')
  const checkboxes = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
  expect(checkboxes).toHaveLength(1)
  expect(checkboxes[0].checked).toBe(false)
  expect(host.textContent).toContain('AWASIN bisa saja salah')
  await act(async () => checkboxes[0].click())
  await submit(host)
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
    mode: 'message', message_ai_consent: true, message_openrouter_consent: true,
    message_link_consent: true, message_link_enhanced_consent: true,
  })
  expect(host.textContent).toContain('Penilaian Nemotron (OpenRouter) tervalidasi')
  expect(host.querySelector('.url-result-card h4')?.textContent).toBe('Aman')
  expect(checkboxes[0].checked).toBe(false)
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
  const result = await aiScan().json()
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, history_status: 'saved' }))
  const host = await mount('link', identity)
  await enterText(host.querySelector<HTMLInputElement>('#scan-text')!, 'https://example.com')
  await submit(host)
  if (sessionId === identity.id) {
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer fixture-token')
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).history_consent).toBe(true)
    expect(host.querySelector('.url-result-card')?.textContent).toContain('Tersimpan di Riwayat.')
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
