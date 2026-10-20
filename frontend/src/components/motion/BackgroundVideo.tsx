import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export const HERO_VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4'

export function BackgroundVideo() {
  const reducedMotion = usePrefersReducedMotion()
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element) return
    const syncPlayback = () => {
      if (document.hidden || reducedMotion) element.pause()
      else void element.play().catch(() => {
        // Autoplay rejection keeps the static fallback. Do not pause a newer
        // play attempt when StrictMode cleanup aborts the previous promise.
      })
    }
    syncPlayback()
    document.addEventListener('visibilitychange', syncPlayback)
    return () => { document.removeEventListener('visibilitychange', syncPlayback); element.pause() }
  }, [reducedMotion])

  // No video element or media request when reduced motion is enabled.
  if (reducedMotion) return null
  return <video ref={video} className="hero-video" src={HERO_VIDEO_URL} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} disablePictureInPicture onError={(event) => { event.currentTarget.hidden = true }} />
}
