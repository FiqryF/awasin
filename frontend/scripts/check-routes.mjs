import { runSequentially } from './run-sequentially.mjs'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { PassThrough } from 'node:stream'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
async function renderPage(element) {
  return new Promise((resolve,reject)=>{
    const stream=new PassThrough();let html=''
    stream.on('data',chunk=>{html+=chunk});stream.on('end',()=>resolve(html));stream.on('error',reject)
    const renderer=renderToPipeableStream(element,{onAllReady(){renderer.pipe(stream)},onError:reject})
  })
}
try {
  const { AppRoutes } = await server.ssrLoadModule('/src/routes/AppRoutes.tsx')
  const { placeholderRoutes } = await server.ssrLoadModule('/src/routes/routeConfig.ts')
  const { AuthContext } = await server.ssrLoadModule('/src/features/auth/context.ts')
  // Rendering fixtures only: real route authorization is tested separately.
  const fixtureIdentity = { id: 'ssr-fixture', email: 'local@example.invalid', role: 'admin', aal: 'aal2', profile: { id: 'ssr-fixture', display_name: 'SSR fixture' } }
  const expectedPaths = ['/settings', '/admin', '/admin/domains', '/admin/articles', '/admin/feedback']
  assert.deepEqual(placeholderRoutes.map(({ path }) => path), expectedPaths)
  await runSequentially([{ path: '/', title: 'Jangan asal klik.' }, { path: '/dashboard', title: 'Selamat datang kembali' }, { path: '/feedback', title: 'Ada yang perlu' }, {path:'/education',title:'Kenali modusnya.'}, {path:'/education/phishing',title:'Cermati link, bukan hanya tampilannya.'}, {path:'/education/tidak-ada',title:'Artikel tidak ditemukan.'}, { path: '/history', title: 'Riwayat Pemeriksaanmu.' }, { path: '/history/tidak-valid', title: 'Detail Hasil Pemeriksaan' }, ...['link', 'message', 'website', 'qr', 'media'].map(mode => ({ path: `/scan/${mode}`, title: 'Periksa konten mencurigakan.' })), ...placeholderRoutes, { path: '/tidak-ada', title: 'Halaman tidak ditemukan' }], async ({ path, title }) => {
    // The root now redirects verified accounts; render its public content as a guest.
    const pageIdentity = path === '/' ? null : fixtureIdentity
    const html = await renderPage(createElement(AuthContext.Provider, { value: { loading: false, identity: pageIdentity, error: '', refresh: async () => pageIdentity } }, createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes))))
    assert.ok(html.includes(title), `Missing title: ${path}`)
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `Expected one h1: ${path}`)
    assert.ok(html.includes('<main') && html.includes('<footer'), `Missing layout: ${path}`)
    if (path === '/feedback') {
      assert.ok(!html.includes('floating-header'), 'Feedback must not render the site navbar')
      assert.ok(html.includes('Kembali ke beranda'), 'Feedback must provide a home link')
    }
    if (path === '/') {
      for (const id of ['beranda', 'periksa', 'edukasi']) assert.ok(html.includes(`id="${id}"`), `Missing section: ${id}`)
      assert.equal((html.match(/role="tab"/g) ?? []).length, 6)
      assert.ok(html.includes('href="/education"'))
      assert.ok(html.includes('href="#periksa"'))
    }
    if (path === '/dashboard') {
      for (const id of ['beranda', 'periksa', 'edukasi']) assert.ok(html.includes(`id="${id}"`), `Missing dashboard section: ${id}`)
      assert.ok(html.includes('SSR fixture'), 'Dashboard must use verified profile name')
      assert.equal((html.match(/role="tab"/g) ?? []).length, 6)
      assert.ok(html.includes('Memuat aktivitas pemeriksaan'), 'History must load real account records')
      assert.ok(html.includes('Menu akun') && !html.includes('Masuk ke akun AWASIN'), 'Authenticated navbar must expose profile instead of login')
    }
    console.log(`PASS ${path}`)
  })
  const authRoutes = [
    { path: '/login', title: 'Selamat Datang Kembali' },
    { path: '/register', title: 'Bergabung dengan AWASIN' },
    { path: '/forgot-password', title: 'Lupa Kata Sandi?' },
    { path: '/reset-password', title: 'Buat Kata Sandi Baru' },
    { path: '/verify-email', title: 'Cek Emailmu' },
  ]
  await runSequentially(authRoutes, async ({ path, title }) => {
    const html = await renderPage(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes)))
    assert.ok(html.includes(title) && html.includes('auth-root'), `Missing auth page: ${path}`)
    assert.equal((html.match(/<h1[\s>]/g)??[]).length,1,`Expected one accessible auth h1: ${path}`)
    assert.ok(html.includes('<main'),`Missing auth main landmark: ${path}`)
    assert.ok(html.includes('assets/brand/logo-honeydew.png') && html.includes('assets/brand/logo-blood-red.png'), `Missing brand assets: ${path}`)
    assert.ok(!html.includes('floating-header'), `Unexpected site navbar: ${path}`)
    console.log(`PASS ${path}`)
  })
  const { validateScanInput, validateFile } = await server.ssrLoadModule('/src/features/scan/scanConfig.ts')
  for (const mode of ['link', 'website']) {
    for (const url of ['', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/plain,test']) assert.ok(validateScanInput(mode, url, null), `Must reject: ${url}`)
    for (const url of ['https://contoh.com', ' https://contoh.com/path?q=1 ']) assert.equal(validateScanInput(mode, url, null), null)
  }
  assert.ok(validateScanInput('link', 'contoh.com', null))
  assert.equal(validateScanInput('website', 'contoh.com', null), null)
  const image = { type: 'image/png', size: 1024 }
  const video = { type: 'video/mp4', size: 2048 }
  assert.ok(validateScanInput('message', 'pendek', null))
  assert.equal(validateScanInput('message', 'Pesan ini cukup panjang', null), null)
  assert.equal(validateScanInput('message', '', image), null)
  assert.ok(validateScanInput('message', 'a'.repeat(10001), null))
  for (const mode of ['qr', 'image', 'video']) assert.ok(validateScanInput(mode, '', null))
  for (const mode of ['qr', 'image']) assert.equal(validateScanInput(mode, '', image), null)
  assert.equal(validateScanInput('video', '', video), null)
  assert.ok(validateFile(video, 'image'))
  assert.ok(validateFile(image, 'video'))
  assert.ok(validateFile({ type: 'image/svg+xml', size: 10 }, 'image'))
  assert.ok(validateFile({ ...image, size: 0 }, 'qr'))
  assert.equal(validateFile({ ...image, size: 10 * 1024 * 1024 }, 'image'), null)
  assert.ok(validateFile({ ...image, size: 10 * 1024 * 1024 + 1 }, 'image'))
  assert.equal(validateFile({ ...video, size: 50 * 1024 * 1024 }, 'video'), null)
  assert.ok(validateFile({ ...video, size: 50 * 1024 * 1024 + 1 }, 'video'))
  console.log('PASS six scan modes, URL protocols, message lengths, MIME types and file-size boundaries')
  const { isValidEmail } = await server.ssrLoadModule('/src/utils/isValidEmail.ts')
  for (const email of ['nama@contoh.com', 'nama+tag@sub.contoh.id', `${'a'.repeat(249)}@b.co`]) {
    assert.equal(isValidEmail(email), true, `Must accept valid email: ${email}`)
  }
  for (const email of ['', '@contoh.com', 'nama@@contoh.com', 'nama@contoh', 'nama@contoh.', 'nama @contoh.com', 'nama@con\ntoh.com', 'nama@con\u00a0toh.com', ' nama@contoh.com ', `${'a'.repeat(250)}@b.co`, `${'a'.repeat(100000)}@b.co`]) {
    assert.equal(isValidEmail(email), false, 'Must reject malformed or oversized email')
  }
  console.log('PASS shared email validation, whitespace, duplicate separators and length boundaries')
  const { emptyFeedback, feedbackCategories, feedbackFields, validateFeedback, readFeedbackEntry } = await server.ssrLoadModule('/src/features/feedback/feedbackModel.ts')
  await runSequentially(feedbackCategories, async ({ id }) => {
    const categoryHtml = await renderPage(createElement(MemoryRouter, { initialEntries: [{ pathname: '/feedback', state: { feedbackCategory: id } }] }, createElement(AppRoutes)))
    const ids = [...categoryHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
    assert.equal(new Set(ids).size, ids.length, `Duplicate IDs in feedback category: ${id}`)
    assert.ok(categoryHtml.includes('<form'), `Missing dynamic feedback form: ${id}`)
    assert.equal((categoryHtml.match(/<form[\s>]/g) ?? []).length, 1, `Expected a single feedback form: ${id}`)
    assert.ok(categoryHtml.includes('<legend>Isi laporan</legend>'), `Missing report field group: ${id}`)
    const valid = { ...emptyFeedback, privacy: true, description: 'Masukan yang cukup jelas untuk ditinjau.' }
    for (const field of feedbackFields[id]) {
      if (field.required && field.name !== 'description') valid[field.name] = field.options?.[0] ?? 'Judul masukan'
    }
    assert.deepEqual(validateFeedback(id, valid), {}, `Valid feedback: ${id}`)
    assert.ok(validateFeedback(id, { ...valid, description: 'singkat' }).description)
    assert.ok(validateFeedback(id, { ...valid, privacy: false }).privacy)
    assert.ok(validateFeedback(id, { ...valid, email: 'invalid' }).email)
    assert.deepEqual(validateFeedback(id, { ...valid, email: 'nama@contoh.com' }), {})
    for (const email of ['nama+feedback@sub.contoh.com', ' nama@contoh.com ']) assert.deepEqual(validateFeedback(id, { ...valid, email }), {})
    for (const email of ['@contoh.com', 'nama@@contoh.com', 'nama@contoh', 'nama@contoh.', 'nama @contoh.com', 'nama@contoh. com', 'na\tma@contoh.com', 'nama@con\ntoh.com', 'nama@con\u00a0toh.com', 'a'.repeat(255), `nama@${'a'.repeat(230)}.`]) {
      assert.ok(validateFeedback(id, { ...valid, email }).email, `Must reject malformed email: ${email}`)
    }
    for (const field of feedbackFields[id]) {
      assert.ok(validateFeedback(id, { ...valid, [field.name]: 'a'.repeat(field.max + 1) })[field.name])
      if (field.required) assert.ok(validateFeedback(id, { ...valid, [field.name]: '' })[field.name])
      if (field.options) assert.ok(validateFeedback(id, { ...valid, [field.name]: 'opsi tidak tersedia' })[field.name])
    }
  })
  assert.deepEqual(readFeedbackEntry(null), { category: null, scanReference: '' })
  assert.deepEqual(readFeedbackEntry({ feedbackCategory: 'invalid', scanReference: 'x' }), { category: null, scanReference: '' })
  assert.deepEqual(readFeedbackEntry({ feedbackCategory: 'detection', scanReference: ' test-reference ' }), { category: 'detection', scanReference: 'test-reference' })
  assert.deepEqual(readFeedbackEntry({ feedbackCategory: 'bug', scanReference: 'x' }), { category: 'bug', scanReference: '' })
  console.log('PASS feedback categories, required fields, length limits, option allowlists, email, privacy and report entry state')
  const { API_BASE_URL, apiRequest } = await server.ssrLoadModule('/src/services/api.ts')
  const originalFetch = globalThis.fetch
  try {
    let calls = 0
    globalThis.fetch = async (url) => { calls++; assert.equal(url, `${API_BASE_URL}/health`); return Response.json({ status: 'ok' }) }
    assert.deepEqual(await apiRequest('/health'), { status: 'ok' })
    await assert.rejects(apiRequest('//external.example'), /relatif/)
    assert.equal(calls, 1)
    globalThis.fetch = async () => new Response(null, { status: 204 })
    assert.equal(await apiRequest('/empty'), undefined)
    globalThis.fetch = async () => new Response(null, { status: 503 })
    await assert.rejects(apiRequest('/unavailable'), /503/)
    console.log('PASS API transport (mock fetch only; no backend requests)')
  } finally { globalThis.fetch = originalFetch }
} finally { await server.close() }
