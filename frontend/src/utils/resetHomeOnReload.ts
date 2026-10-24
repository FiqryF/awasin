/** Reset only a full reload of the guest/account home, before BrowserRouter reads its URL. */
export function resetHomeOnReload() {
  const navigation = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
  if (navigation?.type !== 'reload' || !['/', '/dashboard'].includes(window.location.pathname)) return
  window.history.scrollRestoration = 'manual'
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  const top = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  top()
  // Native restoration can also run after the entry module, when the document is shown.
  window.addEventListener('pageshow', top, { once: true })
}
