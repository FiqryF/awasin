import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export const HERO_VIDEO_URL = `${import.meta.env.BASE_URL}assets/video/hero.mp4`

type BackgroundVideoProps = Readonly<{ src?: string; className?: string }>

export function BackgroundVideo({ src = HERO_VIDEO_URL, className = 'hero-video' }: BackgroundVideoProps) {
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
  }, [reducedMotion, src])

  // No video element or media request when reduced motion is enabled.
  if (reducedMotion) return null
  return <video ref={video} className={className} src={src} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} disablePictureInPicture onError={(event) => { event.currentTarget.hidden = true }} />
}
