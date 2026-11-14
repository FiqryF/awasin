import { afterEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QrCamera } from '../src/features/scan/QrCamera'

const mock = vi.hoisted(() => ({ decodeQrPixels: vi.fn() }))
vi.mock('../src/features/scan/decodeQr', async original => ({
  ...await original<object>(),
  decodeQrPixels: mock.decodeQrPixels,
}))

let cleanup: (() => void) | undefined
afterEach(async () => {
  if (cleanup) await act(async () => cleanup?.())
  cleanup = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function mount(onDecoded = vi.fn()) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  const stop = vi.fn()
  const track = { stop }
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }) as unknown as MediaStream)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  Object.defineProperties(HTMLMediaElement.prototype, {
    readyState: { configurable: true, value: HTMLMediaElement.HAVE_CURRENT_DATA },
  })
  Object.defineProperties(HTMLVideoElement.prototype, {
    videoWidth: { configurable: true, value: 640 },
    videoHeight: { configurable: true, value: 480 },
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  } as unknown as CanvasRenderingContext2D)

  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<QrCamera onDecoded={onDecoded} />))
  cleanup = () => { root.unmount(); host.remove() }
  return { host, getUserMedia, onDecoded, stop }
}

it('does not request camera permission until the user asks to scan', async () => {
  const { host, getUserMedia } = await mount()
  expect(getUserMedia).not.toHaveBeenCalled()
  expect(host.querySelector('video')?.hidden).toBe(true)
})

it('requests camera permission after click and releases the stream on stop', async () => {
  const { host, getUserMedia, stop } = await mount()
  mock.decodeQrPixels.mockResolvedValue(null)
  await act(async () => host.querySelector<HTMLButtonElement>('.qr-camera-toggle')!.click())
  expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
    audio: false,
    video: expect.objectContaining({ facingMode: { ideal: 'environment' } }),
  }))
  expect(host.querySelector('video')?.hidden).toBe(false)
  await act(async () => host.querySelector<HTMLButtonElement>('.qr-camera-toggle')!.click())
  expect(stop).toHaveBeenCalledOnce()
  expect(host.querySelector('video')?.hidden).toBe(true)
})

it('stops the camera and returns a decoded QR value without a network request', async () => {
  const onDecoded = vi.fn()
  const { host, stop } = await mount(onDecoded)
  mock.decodeQrPixels.mockResolvedValueOnce('https://example.com')
  await act(async () => host.querySelector<HTMLButtonElement>('.qr-camera-toggle')!.click())
  expect(onDecoded).toHaveBeenCalledWith('https://example.com')
  expect(stop).toHaveBeenCalledOnce()
  expect(host.textContent).not.toContain('Menghubungi')
})
