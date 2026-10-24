import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthContext } from '../src/features/auth/context'
import { ScanHistoryPage } from '../src/pages/ScanHistoryPage'
import { AnalysisDetailPage } from '../src/pages/AnalysisDetailPage'
import { SaveReportAction } from '../src/features/history/SaveReportAction'
import type { ReportDetail } from '../src/features/history/contracts'
import { HistoryError } from '../src/features/history/api'

const api = vi.hoisted(() => ({ listHistory: vi.fn(), getReport: vi.fn(), deleteHistory: vi.fn(), saveReport: vi.fn() }))
vi.mock('../src/features/history/api', async importOriginal => ({ ...await importOriginal<object>(), ...api }))
const id = '11111111-1111-4111-8111-111111111111'
const report: ReportDetail = { id, mode: 'qr', created_at: '2026-10-23T10:00:00Z', saved_at: '2026-10-23T10:01:00Z', safe_label: 'Ringkasan aman fixture', status: 'completed', risk: null, engine: 'test-only', engine_version: '1', analyzed_at: '2026-10-23T10:00:01Z', result: { risk: null, findings: [], sources: [], checks: [], recommendations: [] } }
const identity = { id: 'fixture-a', email: 'fixture@example.invalid', role: 'user' as const, aal: 'aal1' as const, profile: { id: 'fixture-a', display_name: 'Fixture' } }
let cleanup: (() => void) | undefined
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.clearAllMocks()
  api.listHistory.mockResolvedValue({ items: [], next_cursor: null })
  api.getReport.mockResolvedValue(report)
  api.deleteHistory.mockResolvedValue(1)
  api.saveReport.mockResolvedValue(report)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
afterEach(async () => { if (cleanup) await act(async () => cleanup?.()); cleanup = undefined })
async function render(content: ReactNode, path = '/history') {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const draw = (owner = identity) => root.render(<AuthContext.Provider value={{ identity: owner, loading: false, error: '', refresh: async () => owner }}><MemoryRouter initialEntries={[path]}>{content}</MemoryRouter></AuthContext.Provider>)
  await act(async () => draw())
  cleanup = () => { root.unmount(); host.remove() }
  return { host, redraw: async (owner: typeof identity) => { await act(async () => draw(owner)) } }
}
async function click(element: Element) { await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })) }) }
function button(text: string, parent: ParentNode = document): Element { return [...parent.querySelectorAll('button')].find(element => element.textContent?.includes(text))! }

describe('account history UI', () => {
  it('distinguishes empty history, filtering and server failure', async () => {
    const { host } = await render(<ScanHistoryPage />)
    expect(host.textContent).toContain('Belum ada pemeriksaan tersimpan.')
    const mode = host.querySelector<HTMLSelectElement>('#history-mode')!
    await act(async () => { mode.value = 'video'; mode.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.listHistory).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'video' }), expect.any(AbortSignal))
    expect(host.textContent).toContain('Tidak ada riwayat yang cocok.')
    api.listHistory.mockRejectedValueOnce(new HistoryError(503, 'Layanan belum tersedia.'))
    await click(button('Reset filter', host))
    expect(host.textContent).toContain('Riwayat belum dapat dimuat.')
    expect(host.textContent).not.toContain('Belum ada pemeriksaan tersimpan.')
    await click(button('Coba lagi', host))
    expect(host.textContent).toContain('Belum ada pemeriksaan tersimpan.')
  })
  it('requests cursor pagination, sort and submitted search on the server', async () => {
    api.listHistory.mockResolvedValue({ items: [report], next_cursor: 'fixture-next' })
    const { host } = await render(<ScanHistoryPage />)
    await click(button('Berikutnya', host))
    expect(api.listHistory).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'fixture-next' }), expect.any(AbortSignal))
    const sort = host.querySelector<HTMLSelectElement>('#history-sort')!
    await act(async () => { sort.value = 'oldest'; sort.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.listHistory).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'oldest', cursor: undefined }), expect.any(AbortSignal))
    const input = host.querySelector<HTMLInputElement>('#history-search')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'kata aman'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(api.listHistory).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'kata aman' }), expect.any(AbortSignal))
  })
  it('waits for delete confirmation and preserves records when deletion fails', async () => {
    api.listHistory.mockResolvedValue({ items: [report], next_cursor: null })
    const { host } = await render(<ScanHistoryPage />)
    await click(host.querySelector('[aria-label="Hapus Ringkasan aman fixture"]')!)
    expect(api.deleteHistory).not.toHaveBeenCalled()
    expect(document.querySelector('dialog')?.open).toBe(true)
    api.deleteHistory.mockRejectedValueOnce(new Error('Penghapusan gagal.'))
    await click(button('Ya, hapus permanen'))
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toBe('Penghapusan gagal.')
    expect(host.textContent).toContain(report.safe_label)
    api.listHistory.mockResolvedValue({ items: [], next_cursor: null })
    await click(button('Ya, hapus permanen'))
    expect(host.textContent).toContain('1 laporan berhasil dihapus.')
    expect(document.querySelector('dialog')).toBeNull()
  })
  it('hides prior-account records immediately and ignores its late request', async () => {
    const { host, redraw } = await render(<ScanHistoryPage />)
    let resolveOld!: (data: unknown) => void
    api.listHistory.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await redraw({ ...identity, id: 'fixture-b' })
    expect(host.textContent).toContain('Memuat riwayat')
    await redraw({ ...identity, id: 'fixture-c' })
    await act(async () => resolveOld({ items: [report], next_cursor: null }))
    expect(host.textContent).not.toContain(report.safe_label)
  })
})

describe('verified analysis detail', () => {
  it('renders only provided evidence and sends an ID-only Feedback entry', async () => {
    function FeedbackFixture() { const location = useLocation(); return <p>{JSON.stringify(location.state)}</p> }
    const { host } = await render(<Routes><Route path="/history/:id" element={<AnalysisDetailPage />} /><Route path="/feedback" element={<FeedbackFixture />} /></Routes>, `/history/${id}`)
    expect(host.textContent).toContain(report.safe_label)
    expect(host.textContent).not.toMatch(/Indikasi Risiko|Bukti dan Temuan|Langkah yang Disarankan/)
    expect(host.querySelector('a[href="/dashboard?mode=qr#periksa"]')).not.toBeNull()
    await click(host.querySelector('a[href="/feedback"]')!)
    expect(JSON.parse(host.textContent!)).toEqual({ feedbackCategory: 'detection', scanReference: id })
  })
  it('reports inaccessible records without showing cached evidence', async () => {
    api.getReport.mockRejectedValueOnce(new HistoryError(404, 'Tidak ditemukan.'))
    const { host } = await render(<Routes><Route path="/history/:id" element={<AnalysisDetailPage />} /></Routes>, `/history/${id}`)
    expect(host.textContent).toContain('Laporan tidak ditemukan.')
    expect(host.textContent).not.toContain(report.safe_label)
  })
  it('provides general reading from real mode metadata and does not attach an unsaved report to Feedback',async()=>{
    api.getReport.mockResolvedValueOnce({...report,saved_at:null})
    function FeedbackFixture(){const location=useLocation();return <p>{JSON.stringify(location.state)}</p>}
    const {host}=await render(<Routes><Route path="/history/:id" element={<AnalysisDetailPage/>}/><Route path="/feedback" element={<FeedbackFixture/>}/></Routes>,`/history/${id}?preview=true`)
    expect(host.querySelector('a[href="/education/keamanan-qr"]')).not.toBeNull()
    expect(host.textContent).toContain('bukan temuan atau penilaian tambahan')
    expect(host.querySelector('a[href="/feedback"]')?.textContent).toBe('Kirim masukan')
    await click(host.querySelector('a[href="/feedback"]')!)
    expect(JSON.parse(host.textContent!)).toEqual({feedbackCategory:'detection'})
  })
  it.each(['pending', 'processing', 'failed', 'unsupported'] as const)('does not offer completed-report saving for %s', async status => {
    const { host } = await render(<SaveReportAction report={{ ...report, saved_at: null, status }} onSaved={vi.fn()} />)
    expect(host.textContent).toBe('')
  })
  it('offers saving only after explicit consent and reports save failure', async () => {
    const onSaved = vi.fn()
    api.saveReport.mockRejectedValueOnce(new Error('Belum tersimpan.'))
    const { host } = await render(<SaveReportAction report={{ ...report, saved_at: null }} onSaved={onSaved} />)
    expect(host.querySelector('button')?.disabled).toBe(true)
    await click(host.querySelector('input')!)
    await click(button('Simpan ke Riwayat', host))
    expect(api.saveReport).toHaveBeenCalledWith(id, true)
    expect(onSaved).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Belum tersimpan.')
    await click(button('Simpan ke Riwayat', host))
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
