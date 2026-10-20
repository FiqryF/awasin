import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { AppRoutes } = await server.ssrLoadModule('/src/routes/AppRoutes.tsx')
  const { placeholderRoutes } = await server.ssrLoadModule('/src/routes/routeConfig.ts')
  const expectedPaths = ['/scan/link', '/scan/message', '/scan/website', '/scan/qr', '/scan/media', '/education', '/feedback', '/login', '/register', '/forgot-password', '/history', '/settings', '/admin', '/admin/domains', '/admin/articles', '/admin/feedback']
  assert.deepEqual(placeholderRoutes.map(({ path }) => path), expectedPaths)
  for (const { path, title } of [{ path: '/', title: 'Jangan asal klik.' }, ...placeholderRoutes, { path: '/tidak-ada', title: 'Halaman tidak ditemukan' }]) {
    const html = renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes)))
    assert.ok(html.includes(title), `Missing title: ${path}`)
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `Expected one h1: ${path}`)
    assert.ok(html.includes('<main') && html.includes('<footer'), `Missing layout: ${path}`)
    if (path === '/') {
      for (const id of ['beranda', 'periksa', 'edukasi']) assert.ok(html.includes(`id="${id}"`), `Missing section: ${id}`)
      assert.equal((html.match(/role="tab"/g) ?? []).length, 6)
      assert.ok(html.includes('href="/education"'))
      assert.ok(html.includes('href="#periksa"'))
    }
    console.log(`PASS ${path}`)
  }
  const { validateScanInput, validateFile } = await server.ssrLoadModule('/src/features/scan/scanConfig.ts')
  for (const mode of ['link', 'website']) {
    for (const url of ['', 'contoh.com', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/plain,test']) assert.ok(validateScanInput(mode, url, null), `Must reject: ${url}`)
    for (const url of ['https://contoh.com', ' https://contoh.com/path?q=1 ']) assert.equal(validateScanInput(mode, url, null), null)
  }
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
