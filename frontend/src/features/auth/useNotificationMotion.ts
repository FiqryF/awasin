import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { animate, type AnimationPlaybackControls } from 'motion/react'

export function useNotificationMotion(card: RefObject<HTMLElement | null>, progress: RefObject<HTMLSpanElement | null>, autoDismiss: boolean, paused: boolean, reducedMotion: boolean, dismiss: () => void) {
  const countdown = useRef<AnimationPlaybackControls | null>(null)
  const pausedRef = useRef(paused)
  const requestClose = useRef<() => void>(() => {})
  useEffect(() => {
    const element = card.current
    const stage = element?.parentElement
    if (!element || !stage) return
    let active = true
    let closing = false
    const controls = new Set<AnimationPlaybackControls>()
    const track = (control: AnimationPlaybackControls) => { controls.add(control); return control }
    const close = () => {
      if (!active || closing) return
      closing = true
      controls.forEach(control => control.stop())
      const duration = reducedMotion ? .08 : .18
      track(animate(stage, { opacity: 0 }, { duration }))
      const exit = track(animate(element, reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: .98 }, { duration, ease: 'easeIn' }))
      void exit.finished.then(() => { if (active) dismiss() }).catch(() => {})
    }
    requestClose.current = close
    track(animate(stage, { opacity: [0, 1] }, { duration: reducedMotion ? .08 : .2 }))
    const entrance = track(animate(element, reducedMotion ? { opacity: [0, 1] } : { opacity: [0, 1], y: [12, 0], scale: [.96, 1] }, { duration: reducedMotion ? .08 : .28, ease: [.16, 1, .3, 1] }))
    async function playLifetime() {
      await entrance.finished
      if (!active || closing || !autoDismiss || !progress.current) return
      const hold = track(animate(progress.current, { scaleX: [1, 0] }, { duration: 2.6, ease: 'linear' }))
      countdown.current = hold
      if (pausedRef.current) hold.pause()
      await hold.finished
      if (active && !closing) close()
    }
    void playLifetime().catch(() => {})
    return () => {
      active = false
      countdown.current = null
      requestClose.current = () => {}
      controls.forEach(control => control.stop())
    }
  }, [card, progress, autoDismiss, reducedMotion, dismiss])
  useEffect(() => {
    pausedRef.current = paused
    if (paused) countdown.current?.pause()
    else countdown.current?.play()
  }, [paused])
  return useCallback(() => requestClose.current(), [])
}
