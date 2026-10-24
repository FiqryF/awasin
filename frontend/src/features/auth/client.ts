import { createClient } from '@supabase/supabase-js'
import { timedAuthFetch } from './transport'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Public project configuration only. No service-role/secret keys in VITE_*.
// Accept only the modern publishable-key format; never bundle admin keys intentionally.
export const supabase = url?.startsWith('https://') && key?.startsWith('sb_publishable_') ? createClient(url, key, {
  global: { fetch: timedAuthFetch },
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null

export function requireSupabase() {
  if (!supabase) throw new Error('Layanan akun belum dikonfigurasi pada perangkat ini.')
  return supabase
}

// A fresh credential check must not overwrite the application's active session.
export function reauthenticationClient() {
  if (!url || !key || !supabase) throw new Error('Layanan akun belum dikonfigurasi.')
  return createClient(url, key, { global: { fetch: timedAuthFetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
