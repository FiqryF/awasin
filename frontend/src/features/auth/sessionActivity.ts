/** Browser inactivity policy, not a replacement for provider/DB authorization. */
export const IDLE_TIMEOUT_MS = 60 * 60_000
const activityKey = 'awasin.session-activity'
const noticeKey = 'awasin.session-notice'
type Marker = { session: string; at: number; ended: boolean }

export function sessionIdentity(token: string, owner?: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))) as {session_id?: unknown}
    // Used only to namespace activity. JWT authorization remains on the server.
    if (typeof payload.session_id === 'string') return `${owner ?? ''}:${payload.session_id}`
  } catch { /* A malformed token is rejected by identity verification, not trusted here. */ }
  return owner ?? 'unverified-session'
}

function read(): Marker | null {
  try {
    const value = JSON.parse(localStorage.getItem(activityKey) ?? 'null') as Marker | null
    return value && typeof value.session === 'string' && Number.isFinite(value.at) && typeof value.ended === 'boolean' ? value : null
  } catch { return null }
}
export function setSessionNotice(value: 'idle' | 'local-only') {
  try {
    const previous = sessionStorage.getItem(noticeKey)
    sessionStorage.setItem(noticeKey, value === 'local-only' && previous === 'idle' ? 'idle-local-only' : value)
  } catch { /* The session still closes without storage. */ }
}
export function getSessionNotice() {
  try {
    const value = sessionStorage.getItem(noticeKey)
    if (value === 'idle') return 'Anda keluar otomatis setelah 1 jam tanpa aktivitas. Silakan masuk kembali.'
    if (value === 'idle-local-only') return 'Anda keluar otomatis setelah 1 jam tanpa aktivitas. Sesi browser sudah dibersihkan, tetapi pencabutan sesi di layanan belum dapat dikonfirmasi.'
    if (value === 'local-only') return 'Sesi pada browser ini sudah dibersihkan, tetapi pencabutan sesi di layanan belum dapat dikonfirmasi.'
  } catch { /* Storage may be unavailable. */ }
  return ''
}
export function clearSessionNotice() {
  try { sessionStorage.removeItem(noticeKey) } catch { /* Optional notice only. */ }
}

export function monitorSessionActivity(session: string, onExpire: () => void) {
  const existing = read()
  let at = existing?.session === session ? existing.at : Date.now()
  let ended = existing?.session === session && existing.ended
  let disposed = false
  let notified = false
  let persisted = at
  const write = () => {
    try { localStorage.setItem(activityKey, JSON.stringify({session, at, ended})); persisted = at } catch { /* In-memory timeout remains active. */ }
  }
  if (existing?.session !== session) write()

  function check() {
    if (disposed) return false
    const shared = read()
    if (shared?.session === session) {
      at = Math.max(at, shared.at)
      ended ||= shared.ended
    }
    if (ended || Date.now() - at >= IDLE_TIMEOUT_MS) {
      ended = true
      if (!shared?.ended) write()
      if (!notified) { notified = true; onExpire() }
      return false
    }
    return true
  }
  function recordActivity() {
    // Check before recording: waking/typing must not revive an expired session.
    if (document.visibilityState === 'hidden' || !check()) return
    at = Date.now()
    if (at - persisted >= 1000) write()
  }
  const onWake = () => { check() }
  const onStorage = (event: StorageEvent) => { if (event.key === activityKey) check() }
  const flush = () => {
    if (disposed || ended) return
    const shared = read()
    if (shared?.session === session) {
      at = Math.max(at, shared.at)
      ended ||= shared.ended
    }
    if (!ended) write()
  }
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
  for (const event of events) window.addEventListener(event, recordActivity, {passive:true})
  window.addEventListener('focus', onWake)
  window.addEventListener('pageshow', onWake)
  window.addEventListener('storage', onStorage)
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onWake)
  const interval = window.setInterval(check, 1000)
  return {
    session, check,
    dispose() {
      flush(); disposed = true; window.clearInterval(interval)
      for (const event of events) window.removeEventListener(event, recordActivity)
      window.removeEventListener('focus', onWake); window.removeEventListener('pageshow', onWake)
      window.removeEventListener('storage', onStorage); window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onWake)
    },
  }
}
