import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './client'
import { fetchIdentity } from './identity'
import type { Identity } from './identity'
import { AuthContext } from './context'
import type { AuthState } from './context'
import { createAuthActions } from './actions'
import { monitorSessionActivity, sessionIdentity, setSessionNotice } from './sessionActivity'

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<Omit<AuthState, 'refresh'>>({ loading: Boolean(supabase), identity: null, error: '' })
  const generation = useRef(0)
  const activity = useRef<ReturnType<typeof monitorSessionActivity> | null>(null)
  const pending = useRef<{ token: string; result: Promise<Identity | null> } | null>(null)
  const invalidate = useCallback(() => { generation.current++; pending.current = null }, [])
  const verifySession = useCallback(async (token?: string, subject?: string) => {
    const current = ++generation.current
    if (!token) {
      activity.current?.dispose()
      activity.current = null
      setState({ loading: false, identity: null, error: '' })
      return null
    }
    const session = sessionIdentity(token, subject)
    if (activity.current?.session !== session) {
      activity.current?.dispose()
      activity.current = monitorSessionActivity(session, () => {
        generation.current++
        setSessionNotice('idle')
        setState({ loading: false, identity: null, error: '' })
        // Block protected UI immediately; provider cleanup can finish asynchronously.
        if (supabase) {
          const client = supabase
          void client.auth.getSession().then(({ data, error }) => {
            // Another tab may already have replaced this expired login.
            if (!error && data.session && sessionIdentity(data.session.access_token, data.session.user?.id) === session) {
              return createAuthActions(client, window.location.origin).logout()
            }
          }).catch(() => undefined)
        }
      })
    }
    if (!activity.current.check()) return null
    // Background checks must not unmount protected forms (including an active QR).
    setState((previous) => {
      const identity = subject && previous.identity?.id !== subject ? null : previous.identity
      return { identity, loading: !identity, error: '' }
    })
    try {
      const identity = token ? await fetchIdentity(token) : null
      if (current === generation.current && activity.current?.check()) setState({ loading: false, identity, error: '' })
      return current === generation.current ? identity : null
    } catch (error) {
      if (current === generation.current) setState({ loading: false, identity: null, error: error instanceof Error ? error.message : 'Verifikasi sesi gagal.' })
      return null
    }
  }, [])
  const resolve = useCallback((token?: string, subject?: string) => {
    if (token && pending.current?.token === token) return pending.current.result
    const result = verifySession(token, subject)
    pending.current = token ? { token, result } : null
    const clear = () => { if (pending.current?.result === result) pending.current = null }
    void result.then(clear, clear)
    return result
  }, [verifySession])
  const refresh = useCallback(async () => {
    const { data, error } = await supabase?.auth.getSession() ?? { data: { session: null }, error: null }
    if (error) return resolve()
    return resolve(data.session?.access_token, data.session?.user?.id)
  }, [resolve])
  useEffect(() => {
    if (!supabase) return
    let active = true
    let observed = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      observed = true
      // Never await SDK operations inside onAuthStateChange's storage lock.
      queueMicrotask(() => { if (active) void resolve(session?.access_token, session?.user?.id) })
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !observed) void resolve(error ? undefined : data.session?.access_token, data.session?.user?.id)
    }).catch(() => {
      if (active && !observed) void resolve()
    })
    const check = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => { active = false; invalidate(); activity.current?.dispose(); activity.current = null; subscription.unsubscribe(); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [resolve, refresh, invalidate])
  const value = useMemo(() => ({ ...state, refresh }), [state, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
