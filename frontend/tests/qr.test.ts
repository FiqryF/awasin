import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeQr, decodedHttpUrl } from '../src/features/scan/decodeQr'
import { normalizeWebsiteInput } from '../src/features/scan/scanConfig'

const mock = vi.hoisted(() => ({ jsQR: vi.fn() }))
vi.mock('jsqr', () => ({ default: mock.jsQR }))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('safe local QR decoding', () => {
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'mailto:test@example.com', 'WIFI:T:WPA;S:Test;;', 'https://user:password@example.com'])('does not offer to open non-HTTP or credential-bearing QR data: %s', value => {
    expect(decodedHttpUrl(value)).toBeNull()
  })
  it('normalizes HTTP links and domains without requesting their destinations', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect(decodedHttpUrl('https://Example.COM/path?q=1')).toBe('https://example.com/path?q=1')
    expect(normalizeWebsiteInput(' Example.COM/path ')).toBe('https://example.com/path')
    expect(normalizeWebsiteInput('javascript:alert(1)')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects spoofed image signatures before image decoding', async () => {
    const bitmap = vi.fn(); vi.stubGlobal('createImageBitmap', bitmap)
    const file = { slice: () => ({ arrayBuffer: async () => new Uint8Array([60, 115, 118, 103]).buffer }) } as unknown as File
    await expect(decodeQr(file)).rejects.toThrow('Isi file bukan gambar')
    expect(bitmap).not.toHaveBeenCalled()
  })
  it('decodes only locally and releases the bitmap, including no-QR errors', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 10, height: 10, close })))
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(400), width: 10, height: 10 }) } as unknown as CanvasRenderingContext2D)
    const file = { slice: () => ({ arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 0, 0, 0, 0, 0, 0, 0, 0]).buffer }) } as unknown as File
    mock.jsQR.mockReturnValueOnce({ data: 'https://example.com' })
    expect(await decodeQr(file)).toBe('https://example.com')
    expect(fetcher).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledTimes(1)
    mock.jsQR.mockReturnValueOnce(null)
    await expect(decodeQr(file)).rejects.toThrow('tidak ditemukan')
    expect(close).toHaveBeenCalledTimes(2)
  })
  it('rejects excessive pixel dimensions and still releases resources', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 10000, height: 10000, close })))
    const file = { slice: () => ({ arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer }) } as unknown as File
    await expect(decodeQr(file)).rejects.toThrow('Resolusi gambar terlalu besar')
    expect(close).toHaveBeenCalledTimes(1)
  })
})
