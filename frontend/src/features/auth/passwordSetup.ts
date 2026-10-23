import { requireSupabase } from './client'

const key = 'awasin.password-setup'
type Progress = { userId: string; expiresAt: number; completed: boolean }

// UI progress only, never authorization. Every restore checks the provider user;
// password writes are still authorized by Supabase's actual session and policies.
export function rememberPasswordSetup(userId: string, completed = false) {
  try { sessionStorage.setItem(key, JSON.stringify({ userId, completed, expiresAt: Date.now() + 15 * 60_000 })) } catch { /* Storage can be disabled. */ }
}

export function clearPasswordSetup() {
  try { sessionStorage.removeItem(key) } catch { /* Storage can be disabled. */ }
}

export async function restorePasswordSetup(): Promise<'ready' | 'completed' | null> {
  let progress: Progress
  try { progress = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Progress } catch { clearPasswordSetup(); return null }
  if (!progress || typeof progress.userId !== 'string' || typeof progress.expiresAt !== 'number' || progress.expiresAt <= Date.now() || typeof progress.completed !== 'boolean') { clearPasswordSetup(); return null }
  // A completed marker displays only a success notice, even after local logout.
  if (progress.completed) return 'completed'
  const { data, error } = await requireSupabase().auth.getUser()
  if (error || data.user?.id !== progress.userId || !data.user.email_confirmed_at) { clearPasswordSetup(); return null }
  return 'ready'
}
