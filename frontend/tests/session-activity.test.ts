import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IDLE_TIMEOUT_MS, getSessionNotice, monitorSessionActivity, sessionIdentity, setSessionNotice } from '../src/features/auth/sessionActivity'
import { timedAuthFetch } from '../src/features/auth/transport'

const key = 'awasin.session-activity'
let monitors: ReturnType<typeof monitorSessionActivity>[] = []
function monitor(session = 'session-a') {
  const expire = vi.fn()
  const value = monitorSessionActivity(session, expire)
  monitors.push(value)
  return { ...value, expire }
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T00:00:00Z'))
})
afterEach(() => {
  monitors.forEach(value => value.dispose()); monitors = []
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})
it('expires once after an hour and never revives on subsequent input', () => {
  const value = monitor()
  vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1)
  expect(value.expire).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  window.dispatchEvent(new Event('pointerdown'))
  vi.advanceTimersByTime(5000)
  expect(value.expire).toHaveBeenCalledTimes(1)
  expect(value.check()).toBe(false)
})
it('extends the deadline for user input', () => {
  const value = monitor()
  vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000)
  window.dispatchEvent(new Event('keydown'))
  vi.advanceTimersByTime(1000)
  expect(value.check()).toBe(true)
  vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000)
  expect(value.expire).toHaveBeenCalledTimes(1)
})
it('focus and visibility checks do not extend the deadline', () => {
  const value = monitor()
  vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000)
  window.dispatchEvent(new Event('focus'))
  document.dispatchEvent(new Event('visibilitychange'))
  vi.advanceTimersByTime(1000)
  expect(value.expire).toHaveBeenCalledTimes(1)
})
it('checks wall time before recording input after sleep', () => {
  const value = monitor()
  vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS + 1)
  window.dispatchEvent(new Event('pointerdown'))
  expect(value.expire).toHaveBeenCalledTimes(1)
})
it('restores an expired session across page reloads', () => {
  const first = monitor()
  first.dispose()
  vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS)
  const restored = monitor()
  expect(restored.check()).toBe(false)
  expect(restored.expire).toHaveBeenCalledTimes(1)
})
it('shares activity and expiry across tabs without repeatedly rewriting ended markers', () => {
  const value = monitor()
  vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS - 1)
  localStorage.setItem(key, JSON.stringify({ session: 'session-a', at: Date.now(), ended: false }))
  window.dispatchEvent(new StorageEvent('storage', { key }))
  vi.setSystemTime(Date.now() + 2000)
  expect(value.check()).toBe(true)
  localStorage.setItem(key, JSON.stringify({ session: 'session-a', at: Date.now(), ended: true }))
  const write = vi.spyOn(Storage.prototype, 'setItem')
  window.dispatchEvent(new StorageEvent('storage', { key }))
  window.dispatchEvent(new StorageEvent('storage', { key }))
  expect(value.expire).toHaveBeenCalledTimes(1)
  expect(write).not.toHaveBeenCalled()
})
it('does not overwrite newer activity from another tab when disposing', () => {
  const value = monitor()
  const newer = Date.now() + 5000
  localStorage.setItem(key, JSON.stringify({ session: 'session-a', at: newer, ended: false }))
  value.dispose()
  expect(JSON.parse(localStorage.getItem(key)!).at).toBe(newer)
})
it('keeps a new provider session separate from an expired previous login', () => {
  localStorage.setItem(key, JSON.stringify({ session: 'old', at: 1, ended: true }))
  expect(monitor('new').check()).toBe(true)
  const token = (session: string, expiry: number) => `header.${btoa(JSON.stringify({session_id: session, exp: expiry}))}.signature`
  expect(sessionIdentity(token('same', 1), 'user')).toBe(sessionIdentity(token('same', 2), 'user'))
  expect(sessionIdentity(token('other', 2), 'user')).not.toBe(sessionIdentity(token('same', 2), 'user'))
})
it('still expires in memory when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  const value = monitor()
  vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
  expect(value.expire).toHaveBeenCalledTimes(1)
})
it('preserves the idle reason when remote logout cannot be confirmed', () => {
  setSessionNotice('idle'); setSessionNotice('local-only')
  expect(getSessionNotice()).toContain('1 jam')
  expect(getSessionNotice()).toContain('belum dapat dikonfirmasi')
})
it('passes a bounded abort signal and preserves caller cancellation on auth requests', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response())
  vi.stubGlobal('fetch', fetch)
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  const controller = new AbortController()
  await timedAuthFetch('https://auth.example.invalid', { signal: controller.signal })
  expect(timeout).toHaveBeenCalledWith(15_000)
  const signal = fetch.mock.calls[0][1].signal as AbortSignal
  controller.abort()
  expect(signal.aborted).toBe(true)
})
