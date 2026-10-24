import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { deleteHistory, getReport, listHistory, saveReport } from '../src/features/history/api'
import { parseHistory, parseReport } from '../src/features/history/contracts'

const mock = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('../src/features/auth/client', () => ({ requireSupabase: () => ({ auth: { getSession: mock.getSession } }) }))
const id = '11111111-1111-4111-8111-111111111111'
const report = { id, mode: 'link', created_at: '2026-10-23T10:00:00Z', saved_at: null, safe_label: 'Fixture only', status: 'completed', risk: null, engine: 'fixture-only', engine_version: '1', analyzed_at: '2026-10-23T10:00:01Z', result: { risk: null, findings: [], sources: [], checks: [], recommendations: [] } }
beforeEach(() => { mock.getSession.mockResolvedValue({ data: { session: { access_token: 'test-only-token' } }, error: null }) })
afterEach(() => vi.unstubAllGlobals())

describe('history authenticated transport', () => {
  it('preserves cancellation but maps network errors to a safe transport message', async () => {
    const cancelled = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cancelled))
    await expect(getReport(id)).rejects.toBe(cancelled)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network detail')))
    await expect(getReport(id)).rejects.toMatchObject({ status: 0 })
    await expect(getReport(id)).rejects.not.toThrow('private network detail')
  })
  it('uses the current bearer token and safe server-side query parameters', async () => {
    const fetcher = vi.fn(async () => Response.json({ items: [], next_cursor: null }))
    vi.stubGlobal('fetch', fetcher)
    await listHistory({ search: 'Ringkasan aman', mode: 'qr', sort: 'oldest', cursor: 'cursor-fixture', limit: 3 })
    const [address, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    const url = new URL(address)
    expect(url.pathname).toBe('/api/v1/history')
    expect(url.searchParams.get('mode')).toBe('qr')
    expect(url.searchParams.get('search')).toBe('Ringkasan aman')
    expect(init.headers).toEqual({ Authorization: 'Bearer test-only-token' })
    expect(init.cache).toBe('no-store')
    expect(init.credentials).toBe('omit')
  })
  it('requires explicit consent and sends only an existing result reference', async () => {
    const fetcher = vi.fn(async () => Response.json({ ...report, saved_at: report.created_at }))
    vi.stubGlobal('fetch', fetcher)
    await expect(saveReport(id, false)).rejects.toMatchObject({ status: 422 })
    expect(fetcher).not.toHaveBeenCalled()
    await saveReport(id, true)
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body))).toEqual({ report_id: id, consent: true })
  })
  it('rejects absent sessions before network access', async () => {
    mock.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(listHistory({ search: '', mode: '', sort: 'newest' })).rejects.toMatchObject({ status: 401 })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not clear a newly active account using an old account confirmation', async () => {
    mock.getSession.mockResolvedValueOnce({data:{session:{access_token:'fixture-new',user:{id:'new-owner'}}},error:null})
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
    await expect(deleteHistory(undefined,'old-owner')).rejects.toMatchObject({status:401})
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([401, 403, 404, 409, 422, 503])('reports HTTP %i without exposing private provider errors', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('private-provider-error', { status })))
    await expect(getReport(id)).rejects.toMatchObject({ status })
    await expect(getReport(id)).rejects.not.toThrow('private-provider-error')
  })
  it('uses separate explicit clear confirmation and actual deletion counts', async () => {
    const fetcher = vi.fn(async () => Response.json({ deleted: 2 }))
    vi.stubGlobal('fetch', fetcher)
    expect(await deleteHistory()).toBe(2)
    expect(String(fetcher.mock.calls[0][0])).toContain('/history?confirm=true')
  })
  it('rejects malformed IDs without requesting unrelated paths', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(getReport('../../auth/me')).rejects.toMatchObject({ status: 404 })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('untrusted report response validation', () => {
  it('requires completed-analysis provenance and matching risk', () => {
    expect(parseReport(report).id).toBe(id)
    expect(() => parseReport({ ...report, engine: null })).toThrow('terverifikasi')
    expect(() => parseReport({ ...report, risk: 'high' })).toThrow()
    expect(() => parseReport({ ...report, result: { ...report.result, findings: [{ title: 'x', description: '' }] } })).toThrow()
    expect(() => parseReport({ ...report, status: 'unsupported', risk: 'low' })).toThrow()
  })
  it('never treats unsaved or malformed rows as saved history', () => {
    expect(() => parseHistory({ items: [report], next_cursor: null })).toThrow()
    expect(parseHistory({ items: [{ ...report, saved_at: report.created_at }], next_cursor: null }).items).toHaveLength(1)
    expect(() => parseHistory({ items: [], next_cursor: 'x'.repeat(301) })).toThrow()
  })
})
