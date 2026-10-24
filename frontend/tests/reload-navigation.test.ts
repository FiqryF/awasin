import { afterEach, expect, it, vi } from 'vitest'
import { resetHomeOnReload } from '../src/utils/resetHomeOnReload'

afterEach(() => { window.dispatchEvent(new Event('pageshow')); window.history.replaceState(null, '', '/'); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function setup(path: string, type: string) {
  window.history.replaceState({ fixture: true }, '', path)
  vi.stubGlobal('performance', { getEntriesByType: () => [{ type }] })
  window.scrollTo = vi.fn()
}
it.each(['/', '/dashboard'])('returns %s to its hero on reload instead of restoring the scan section', path => {
  setup(`${path}#periksa`, 'reload')
  resetHomeOnReload()
  expect(window.location.hash).toBe('')
  expect(window.history.state).toEqual({ fixture: true })
  expect(window.history.scrollRestoration).toBe('manual')
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  window.dispatchEvent(new Event('pageshow'))
  expect(window.scrollTo).toHaveBeenCalledTimes(2)
})
it.each(['navigate', 'back_forward'])('preserves intentional anchors for %s', type => {
  setup('/dashboard#periksa', type)
  resetHomeOnReload()
  expect(window.location.hash).toBe('#periksa')
  expect(window.scrollTo).not.toHaveBeenCalled()
})
it('keeps non-home routes and anchors on reload', () => {
  setup('/education/phishing#sources', 'reload')
  resetHomeOnReload()
  expect(window.location.pathname + window.location.hash).toBe('/education/phishing#sources')
  expect(window.scrollTo).not.toHaveBeenCalled()
})
