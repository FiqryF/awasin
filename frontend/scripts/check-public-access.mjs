// Read-only HTTP verification. No login, user tokens, writes, or migrations.
import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), 'VITE_')
const cloud = env.VITE_SUPABASE_URL
if (cloud !== 'https://nqruowgbxiopfhslznyb.supabase.co' || !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
  throw new Error('Expected AWASIN project and public publishable-key configuration.')
}
const api = (env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')
const evidence = []
async function probe(category, url, headers, accept) {
  try {
    const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const body = await response.json().catch(() => null)
    const status = accept(response.status, body) ? 'PASS' : 'FAIL'
    // Never print returned private data, credentials, or configuration values.
    evidence.push({ category, status, http: response.status })
  } catch {
    evidence.push({ category, status: 'BLOCKED', reason: 'HTTP service unreachable or timed out' })
  }
}
const denied = (status, body) => [401, 403].includes(status) || (status === 200 && Array.isArray(body) && body.length === 0)
const publicHeaders = { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY }
for (const table of ['profiles', 'user_roles', 'scan_reports', 'feedback_submissions', 'feedback_handling', 'registry_organizations', 'registry_domains', 'admin_audit_events']) {
  await probe(`cloud:guest:${table}`, `${cloud}/rest/v1/${table}?select=*&limit=1`, publicHeaders, denied)
}
// Current observed state: four original articles published; R1 test article archived.
// There is no approved draft fixture: do not mislabel its unexecuted isolation test.
for (const slug of ['phishing', 'pesan-dan-otp', 'keamanan-qr', 'keaslian-media']) {
  await probe(`cloud:published:${slug}`, `${cloud}/rest/v1/education_articles?select=slug,status&slug=eq.${slug}`, publicHeaders,
    (status, body) => status === 200 && body?.length === 1 && body[0].slug === slug && body[0].status === 'published')
  await probe(`api:published:${slug}`, `${api}/api/v1/education/${slug}`, {}, (status, body) => status === 200 && body?.slug === slug)
}
for (const slug of ['uji-phase6-20261029', 'uji-phase7-final-143c736e']) {
  await probe(`cloud:withdrawn:${slug}`, `${cloud}/rest/v1/education_articles?select=slug&slug=eq.${slug}`, publicHeaders,
    (status, body) => status === 200 && Array.isArray(body) && body.length === 0)
  await probe(`api:withdrawn:${slug}`, `${api}/api/v1/education/${slug}`, {}, status => status === 404)
}
for (const path of ['/auth/me', '/account/preferences', '/account/export', '/history', '/admin/identity', '/admin/overview', '/admin/feedback', '/admin/organizations', '/admin/domains', '/admin/articles', '/admin/audit']) {
  await probe(`api:guest:${path}`, `${api}/api/v1${path}`, {}, status => [401, 403].includes(status))
}
console.log(JSON.stringify({ environment: 'anonymous HTTP; local FastAPI plus persistent Supabase cloud; reads only', evidence }, null, 2))
if (evidence.some(item => item.status !== 'PASS')) process.exitCode = 1
