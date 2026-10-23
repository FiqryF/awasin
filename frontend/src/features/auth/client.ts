import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Public project configuration only. No service-role/secret keys in VITE_*.
// Accept only the modern publishable-key format; never bundle admin keys intentionally.
export const supabase = url?.startsWith('https://') && key?.startsWith('sb_publishable_') ? createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null

export function requireSupabase() {
  if (!supabase) throw new Error('Layanan akun belum dikonfigurasi pada perangkat ini.')
  return supabase
}
