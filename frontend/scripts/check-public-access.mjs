// Read-only HTTP verification. No login, user tokens, writes, or migrations.
import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), 'VITE_')
const cloud = env.VITE_SUPABASE_URL
if (cloud !== 'https://nqruowgbxiopfhslznyb.supabase.co' || !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
  throw new Error('Expected AWASIN project and public publishable-key configuration.')
}
function withoutTrailingSlashes(value) {
  let end = value.length
  while (value[end - 1] === '/') end -= 1
  return value.slice(0, end)
}
const api = withoutTrailingSlashes(env.VITE_API_BASE_URL || 'http://localhost:8000')
const probes = []
async function probe({ category, url, headers = {}, accept }) {
  try {
    const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const body = await response.json().catch(() => null)
    const status = accept(response.status, body) ? 'PASS' : 'FAIL'
    // Never print returned private data, credentials, or configuration values.
    return { category, status, http: response.status }
  } catch {
    return { category, status: 'BLOCKED', reason: 'HTTP service unreachable or timed out' }
  }
}
const denied = (status, body) => [401, 403].includes(status) || (status === 200 && Array.isArray(body) && body.length === 0)
const publicHeaders = { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY }
for (const table of ['profiles', 'user_roles', 'scan_reports', 'feedback_submissions', 'feedback_handling', 'registry_organizations', 'registry_domains', 'admin_audit_events']) {
  probes.push({ category: `cloud:guest:${table}`, url: `${cloud}/rest/v1/${table}?select=*&limit=1`, headers: publicHeaders, accept: denied })
}
// Four originals are published; both approved test articles are now archived.
// Draft isolation was tested before archival; this checks current public access.
for (const slug of ['phishing', 'pesan-dan-otp', 'keamanan-qr', 'keaslian-media']) {
  probes.push(
    { category: `cloud:published:${slug}`, url: `${cloud}/rest/v1/education_articles?select=slug,status&slug=eq.${slug}`, headers: publicHeaders,
      accept: (status, body) => status === 200 && body?.length === 1 && body[0].slug === slug && body[0].status === 'published' },
    { category: `api:published:${slug}`, url: `${api}/api/v1/education/${slug}`, accept: (status, body) => status === 200 && body?.slug === slug },
  )
}
for (const slug of ['uji-phase6-20261029', 'uji-phase7-final-143c736e']) {
  probes.push(
    { category: `cloud:withdrawn:${slug}`, url: `${cloud}/rest/v1/education_articles?select=slug&slug=eq.${slug}`, headers: publicHeaders,
      accept: (status, body) => status === 200 && Array.isArray(body) && body.length === 0 },
    { category: `api:withdrawn:${slug}`, url: `${api}/api/v1/education/${slug}`, accept: status => status === 404 },
  )
}
for (const path of ['/auth/me', '/account/preferences', '/account/export', '/history', '/admin/identity', '/admin/overview', '/admin/feedback', '/admin/organizations', '/admin/domains', '/admin/articles', '/admin/audit']) {
  probes.push({ category: `api:guest:${path}`, url: `${api}/api/v1${path}`, accept: status => [401, 403].includes(status) })
}
const evidence = await Promise.all(probes.map(probe))
console.log(JSON.stringify({ environment: 'anonymous HTTP; local FastAPI plus persistent Supabase cloud; reads only', evidence }, null, 2))
if (evidence.some(item => item.status !== 'PASS')) process.exitCode = 1
