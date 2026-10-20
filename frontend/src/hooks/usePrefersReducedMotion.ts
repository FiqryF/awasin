import { useSyncExternalStore } from 'react'

const query = '(prefers-reduced-motion: reduce)'
const getSnapshot = () => window.matchMedia(query).matches
const getServerSnapshot = () => true
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

// React to preference changes while the page is open, including background video.
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
