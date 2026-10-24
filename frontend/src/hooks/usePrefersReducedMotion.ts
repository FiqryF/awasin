import { useSyncExternalStore } from 'react'

const query = '(prefers-reduced-motion: reduce)'
const getSnapshot = () => document.documentElement.dataset.accountMotion === 'reduced' || window.matchMedia(query).matches
const getServerSnapshot = () => true
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  window.addEventListener('awasin-motion-change', callback)
  return () => {media.removeEventListener('change', callback);window.removeEventListener('awasin-motion-change', callback)}
}

// React to preference changes while the page is open, including background video.
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
