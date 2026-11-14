import { useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '../../services/api'
import { AnnouncementsContext, type ServiceAnnouncement } from './useAnnouncements'

export function AnnouncementsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [active, setActive] = useState<ServiceAnnouncement[]>([])
  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    let expiration: number | undefined
    function showCurrent(items: ServiceAnnouncement[]) {
      const now = Date.now()
      const current = items.filter(item => Date.parse(item.ends_at) > now)
      setActive(current)
      window.clearTimeout(expiration)
      if (current.length) {
        const nextEnd = Math.min(...current.map(item => Date.parse(item.ends_at)))
        expiration = window.setTimeout(() => showCurrent(current), Math.min(nextEnd - now, 2_147_483_647))
      }
    }
    async function refresh() {
      if (pending || document.hidden) return
      pending = true
      try {
        const items = await apiRequest<ServiceAnnouncement[]>('/api/v1/announcements', {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        })
        if (!controller.signal.aborted) showCurrent(items)
      } catch {
        // Keep the current list until its scheduled expiry during a temporary outage.
      } finally {
        pending = false
      }
    }
    void refresh()
    const interval = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.clearTimeout(expiration)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return <AnnouncementsContext.Provider value={active}>{children}</AnnouncementsContext.Provider>
}

