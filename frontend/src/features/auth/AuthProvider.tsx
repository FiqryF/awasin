import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './client'
import { fetchIdentity } from './identity'
import { AuthContext } from './context'
import type { AuthState } from './context'

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<Omit<AuthState, 'refresh'>>({ loading: Boolean(supabase), identity: null, error: '' })
  const generation = useRef(0)
  const invalidate = useCallback(() => { generation.current++ }, [])
  const resolve = useCallback(async (token?: string) => {
    const current = ++generation.current
    if (!token) { setState({ loading: false, identity: null, error: '' }); return null }
    // Background checks must not unmount protected forms (including an active QR).
    setState((previous) => ({ ...previous, loading: !previous.identity, error: '' }))
    try {
      const identity = token ? await fetchIdentity(token) : null
      if (current === generation.current) setState({ loading: false, identity, error: '' })
      return current === generation.current ? identity : null
    } catch (error) {
      if (current === generation.current) setState({ loading: false, identity: null, error: error instanceof Error ? error.message : 'Verifikasi sesi gagal.' })
      return null
    }
  }, [])
  const refresh = useCallback(async () => {
    const { data, error } = await supabase?.auth.getSession() ?? { data: { session: null }, error: null }
    if (error) return resolve()
    return resolve(data.session?.access_token)
  }, [resolve])
  useEffect(() => {
    if (!supabase) return
    let active = true
    let observed = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      observed = true
      // Never await SDK operations inside onAuthStateChange's storage lock.
      queueMicrotask(() => { if (active) void resolve(session?.access_token) })
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !observed) void resolve(error ? undefined : data.session?.access_token)
    }).catch(() => {
      if (active && !observed) void resolve()
    })
    const check = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => { active = false; invalidate(); subscription.unsubscribe(); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [resolve, refresh, invalidate])
  const value = useMemo(() => ({ ...state, refresh }), [state, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
