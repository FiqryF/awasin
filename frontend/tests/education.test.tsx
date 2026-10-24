import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { EducationPage, EducationArticlePage } from '../src/pages/EducationPage'
import { articles, articleForMode } from '../src/features/education/articles'
let cleanup:(()=>void)|undefined
beforeEach(()=>Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true}))
afterEach(async()=>{if(cleanup)await act(async()=>cleanup?.());cleanup=undefined;vi.restoreAllMocks()})
async function render(path='/education'){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/education" element={<EducationPage/>}/><Route path="/education/:slug" element={<EducationArticlePage/>}/></Routes></MemoryRouter>))
 cleanup=()=>{root.unmount();host.remove()};return host
}
it('uses the same four real article entries as the dashboard and landing previews',async()=>{
 const host=await render()
 expect(host.querySelectorAll('.education-index article')).toHaveLength(4)
 for(const article of articles)expect(host.querySelector(`a[href="/education/${article.slug}"]`)?.textContent).toContain(article.title)
})
it.each(articles)('renders $slug with readable sections, verified source and related navigation',async article=>{
 const host=await render(`/education/${article.slug}`)
 expect(host.querySelectorAll('h1')).toHaveLength(1)
 expect(host.querySelector('h1')?.textContent).toBe(article.title)
 expect(host.querySelector('a[target="_blank"]')?.getAttribute('href')).toBe(article.source.url)
 expect(host.querySelectorAll('.education-related a')).toHaveLength(3)
 expect(host.textContent).not.toMatch(/Dalam pengembangan|dibaca oleh/)
})
it('offers recovery from an unknown slug without inventing content',async()=>{
 const host=await render('/education/missing')
 expect(host.querySelector('h1')?.textContent).toBe('Artikel tidak ditemukan.')
 expect(host.querySelector('a[href="/education"]')).not.toBeNull()
})
it('maps real input modes to existing general reading without inventing a risk classification',()=>{
 expect(articleForMode('qr')?.slug).toBe('keamanan-qr')
 expect(articleForMode('message')?.slug).toBe('pesan-dan-otp')
 expect(articleForMode('website')?.slug).toBe('phishing')
 expect(articleForMode('image')).toBe(articleForMode('video'))
})
