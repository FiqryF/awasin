import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { AppRoutes } = await server.ssrLoadModule('/src/routes/AppRoutes.tsx')
  const { placeholderRoutes, scanRoutes } = await server.ssrLoadModule('/src/routes/routeConfig.ts')
  const expectedPaths = ['/scan/link', '/scan/message', '/scan/website', '/scan/qr', '/scan/media', '/education', '/feedback', '/login', '/register', '/forgot-password', '/history', '/settings', '/admin', '/admin/domains', '/admin/articles', '/admin/feedback']
  assert.deepEqual(placeholderRoutes.map(({ path }) => path), expectedPaths)
  for (const { path, title } of [{ path: '/', title: 'Cek Dulu,' }, ...placeholderRoutes, { path: '/tidak-ada', title: 'Halaman tidak ditemukan' }]) {
    const html = renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes)))
    assert.ok(html.includes(title), `Missing title: ${path}`)
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `Expected one h1: ${path}`)
    assert.ok(html.includes('<main') && html.includes('<footer'), `Missing layout: ${path}`)
    if (path === '/') for (const scan of scanRoutes) assert.ok(html.includes(`href="${scan.path}"`))
    console.log(`PASS ${path}`)
  }
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
