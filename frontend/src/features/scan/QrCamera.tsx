import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { decodeQrPixels } from './decodeQr'

type Props = Readonly<{ onDecoded: (value: string) => void; disabled?: boolean }>

function cameraError(cause: unknown): string {
  if (!(cause instanceof Error)) return 'Kamera tidak dapat digunakan. Periksa izin dan coba lagi.'
  if (cause.name === 'NotAllowedError' || cause.name === 'SecurityError') return 'Izin kamera ditolak. Izinkan akses kamera di browser atau unggah gambar QR.'
  if (cause.name === 'NotFoundError' || cause.name === 'OverconstrainedError') return 'Kamera tidak ditemukan. Unggah gambar QR sebagai gantinya.'
  if (cause.name === 'NotReadableError') return 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut atau unggah gambar QR.'
  return 'Kamera tidak dapat digunakan. Periksa izin dan coba lagi.'
}

export function QrCamera({ onDecoded, disabled = false }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function releaseCamera() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
  }

  function stopCamera() {
    releaseCamera()
    setActive(false)
  }

  useEffect(() => () => releaseCamera(), [])

  async function startCamera() {
    if (starting || active || disabled) return
    setError(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Kamera memerlukan koneksi aman (HTTPS atau localhost) dan dukungan browser. Kamu tetap bisa mengunggah gambar QR.')
      return
    }

    setStarting(true)
    try {
      const current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      stream.current = current
      if (!video.current) {
        releaseCamera()
        return
      }
      video.current.srcObject = current
      await video.current.play()
      setActive(true)
      const scan = async () => {
        const element = video.current
        if (!element || !stream.current) return
        if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && element.videoWidth > 0) {
          try {
            const canvas = document.createElement('canvas')
            const scale = Math.min(1, 1200 / Math.max(element.videoWidth, element.videoHeight))
            canvas.width = Math.max(1, Math.round(element.videoWidth * scale))
            canvas.height = Math.max(1, Math.round(element.videoHeight * scale))
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (!context) throw new Error('Pembacaan kamera tidak didukung browser ini.')
            context.drawImage(element, 0, 0, canvas.width, canvas.height)
            const value = await decodeQrPixels(context.getImageData(0, 0, canvas.width, canvas.height))
            if (value) {
              releaseCamera()
              setActive(false)
              onDecoded(value)
              return
            }
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Frame kamera tidak dapat dibaca.')
            releaseCamera()
            setActive(false)
            return
          }
        }
        timer.current = setTimeout(() => { void scan() }, 180)
      }
      void scan()
    } catch (cause) {
      releaseCamera()
      setError(cameraError(cause))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="qr-camera">
      <video ref={video} className="qr-camera-preview" autoPlay muted playsInline hidden={!active} aria-label="Pratinjau kamera untuk membaca QR Code" />
      {!active ? (
        <button type="button" className="button qr-camera-toggle" disabled={disabled || starting} onClick={() => void startCamera()}>
          <Camera size={18} aria-hidden="true" /> {starting ? 'Mengaktifkan kamera…' : 'Pindai dengan kamera'}
        </button>
      ) : (
        <div className="qr-camera-active">
          <p>Arahkan kamera ke QR Code. Gambar diproses di perangkatmu.</p>
          <button type="button" className="button qr-camera-toggle" onClick={stopCamera}>
            <CameraOff size={18} aria-hidden="true" /> Hentikan kamera
          </button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
