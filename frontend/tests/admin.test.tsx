import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthContext } from '../src/features/auth/context'
import { ProtectedRoute } from '../src/features/auth/ProtectedRoute'
import { AdminLayout } from '../src/features/admin/AdminLayout'
import { OverviewPage } from '../src/features/admin/OverviewPage'
import { AdminFeedbackPage } from '../src/features/admin/FeedbackPage'
import { DomainsPage } from '../src/features/admin/DomainsPage'
import { ArticlesPage } from '../src/features/admin/ArticlesPage'
import { AuditPage } from '../src/features/admin/AuditPage'
import { articles } from '../src/features/education/articles'
import { useEducation } from '../src/features/education/useEducation'

const mock=vi.hoisted(()=>({request:vi.fn(),logout:vi.fn()}))
vi.mock('../src/features/settings/api',()=>({accountRequest:mock.request}))
vi.mock('../src/features/auth/useLogout',()=>({useLogout:()=>mock.logout}))
const identity={id:'fixture-admin',email:'fixture@example.invalid',role:'admin' as const,aal:'aal1' as const,profile:{id:'fixture-admin',display_name:'Pengelola Fixture'}}
const feedback={id:'feedback-fixture',category:'bug',status:'new',version:1,created_at:'2026-10-29T12:00:00Z',preview:'Masukan fixture',fields:{description:'<script>window.compromised=true</script>'},note:'',contact_email:'private@example.invalid'}
let cleanup:(()=>void)|undefined
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 vi.resetAllMocks()
 HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.open=true})
 HTMLDialogElement.prototype.close=vi.fn(function(this:HTMLDialogElement){this.open=false})
 mock.request.mockImplementation(async(path:string)=>{
  if(path==='/admin/overview')return {feedback_total:4,feedback_new:2,feedback_in_review:1,feedback_resolved:1,domains_verified:0,domains_pending:0,articles_published:4}
  if(path.startsWith('/admin/feedback/'))return feedback
  if(path.startsWith('/admin/feedback?'))return {items:[feedback],total:1}
  if(path.startsWith('/admin/articles/'))return {id:'article-fixture',content:articles[0],status:'published',version:2,updated_at:feedback.created_at}
  if(path.startsWith('/admin/articles?'))return {items:[{id:'article-fixture',title:articles[0].title,slug:articles[0].slug,status:'published',version:2,updated_at:feedback.created_at}],total:1}
  return {items:[],total:0}
 })
})
afterEach(async()=>{if(cleanup)await act(async()=>cleanup?.());cleanup=undefined;vi.unstubAllEnvs()})
async function render(content:React.ReactNode,role:'admin'|'user'|null='admin'){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 const account=role?{...identity,role}:null
 await act(async()=>root.render(<AuthContext.Provider value={{identity:account,loading:false,error:'',refresh:async()=>account}}><MemoryRouter initialEntries={['/admin/dashboard']}><Routes><Route element={<ProtectedRoute admin/>}><Route path="/admin" element={<AdminLayout/>}><Route path="dashboard" element={content}/></Route></Route><Route path="/login" element={<p>LOGIN</p>}/></Routes></MemoryRouter></AuthContext.Provider>))
 cleanup=()=>{root.unmount();host.remove()};return host
}
async function click(host:ParentNode,text:string){const button=[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;expect(button).toBeTruthy();await act(async()=>button.click())}

it.each(['user',null] as const)('does not load admin data for %s',async role=>{
 const host=await render(<OverviewPage/>,role)
 expect(host.textContent).toContain(role?'Akses administrator ditolak.':'LOGIN')
 expect(mock.request).not.toHaveBeenCalled()
})
it('shows only actual response metrics and accessible admin navigation',async()=>{
 const host=await render(<OverviewPage/>)
 expect(host.querySelector('h1')?.textContent).toBe('Kendali yang terukur.')
 expect(host.textContent).toContain('Pengelola Fixture')
 expect(host.querySelectorAll('nav[aria-label="Navigasi administrator"] a')).toHaveLength(5)
 expect(host.querySelector('a[aria-current="page"]')?.textContent).toContain('Ringkasan')
 expect(host.querySelector('.floating-header')).toBeNull()
 expect(host.querySelector('video')).toBeNull()
 expect(host.textContent).not.toContain('99.9%')
 expect(mock.request.mock.calls[0][4]).toBe(identity.id)
})
it('shows API failure honestly and retries',async()=>{
 mock.request.mockRejectedValueOnce(new Error('Layanan belum siap'))
 const host=await render(<OverviewPage/>)
 expect(host.querySelector('[role="alert"]')?.textContent).toBe('Layanan belum siap')
 await click(host,'Muat ulang')
 expect(host.querySelector('[role="alert"]')).toBeNull()
})
it('renders feedback as inert text and saves only handling data with a version',async()=>{
 const host=await render(<AdminFeedbackPage/>)
 await click(host,'Tinjau')
 expect(host.textContent).toContain('<script>window.compromised=true</script>')
 expect(host.querySelector('script')).toBeNull()
 expect(host.querySelector('details')?.textContent).toContain('private@example.invalid')
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 expect(mock.request).toHaveBeenCalledWith('/admin/feedback/feedback-fixture','PATCH',{version:1,status:'new',note:''},undefined,identity.id)
})
it('creates candidates through evidence fields and provides separate explicit review workflow',async()=>{
 const host=await render(<DomainsPage/>)
 await click(host,'Tambah kandidat')
 expect(document.activeElement?.textContent).toBe('Kandidat domain baru')
 expect(host.textContent).toContain('Penjelasan hubungan resmi')
 expect(host.textContent).toContain('Simpan kandidat')
 expect(host.textContent).not.toContain('Keputusan peninjau')
 expect(host.querySelector('input[placeholder="contoh.org"]')).not.toBeNull()
})
it('opens confirmation before archiving a domain candidate',async()=>{
 HTMLDialogElement.prototype.close=vi.fn(function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'))})
 const candidate={id:'domain-fixture',organization_id:'org-fixture',domain:'qa.example.com',status:'pending_review',version:1,created_at:feedback.created_at,evidence_url:'https://example.com/evidence',evidence_description:'Candidate evidence for testing only.'}
 mock.request.mockImplementation(async(path:string)=>({items:path.startsWith('/admin/domains?')?[candidate]:[],total:path.startsWith('/admin/domains?')?1:0}))
 const host=await render(<StrictMode><DomainsPage/></StrictMode>)
 await click(host,'Buka')
 const note=[...host.querySelectorAll('label')].find(l=>l.textContent==='Alasan keputusan')!.querySelector('textarea')!
 await act(async()=>{
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(note,'Uji arsip tanpa verifikasi.')
  note.dispatchEvent(new Event('input',{bubbles:true}))
 })
 await click(host,'Arsipkan')
 expect(host.querySelector('dialog')?.open).toBe(true)
 expect(host.querySelector('dialog')?.textContent).toContain('archived')
})
it('preserves article slug, previews inert content, and requires publish confirmation',async()=>{
 const host=await render(<ArticlesPage/>)
 await click(host,'Edit')
 const slug=[...host.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Slug URL'))?.querySelector('input')
 expect(slug?.readOnly).toBe(true)
 await click(host,'Pratinjau')
 expect(host.querySelector('.admin-preview')?.textContent).toContain(articles[0].sections[0].paragraphs[0])
 await click(host,'Arsipkan')
 expect(host.querySelector('dialog')?.open).toBe(true)
 expect(mock.request.mock.calls.filter(c=>c[1]==='POST')).toHaveLength(0)
 await click(host,'Ya, lanjutkan')
 expect(mock.request).toHaveBeenCalledWith('/admin/articles/article-fixture/status','POST',{version:2,status:'archived'},undefined,identity.id)
})
it('audit is read-only and has an honest empty state',async()=>{
 const host=await render(<AuditPage/>)
 expect(host.textContent).toContain('Belum ada data yang cocok')
 expect(host.querySelector('form')).toBeNull()
})

it('keeps remaining section and source inputs mounted when an earlier item is removed',async()=>{
 const host=await render(<ArticlesPage/>)
 await click(host,'Artikel baru')
 await click(host,'Tambah bagian')
 await click(host,'Tambah bagian')
 const sectionInput=host.querySelectorAll('fieldset')[2].querySelector('input')
 await click(host,'Hapus bagian ini')
 expect(host.querySelectorAll('fieldset')[1].querySelector('input')).toBe(sectionInput)
 await click(host,'Tambah sumber rujukan')
 await click(host,'Tambah sumber rujukan')
 const sourceInput=[...host.querySelectorAll('fieldset')].at(-1)!.querySelector('input')
 await click(host,'Hapus sumber tambahan')
 expect([...host.querySelectorAll('fieldset')].at(-1)!.querySelector('input')).toBe(sourceInput)
})

it('saves article text without sending editor-only IDs to the backend',async()=>{
 mock.request.mockImplementation(async(path:string)=>{
  if(path==='/admin/articles/article-fixture')return {id:'article-fixture',content:articles[0],status:'draft',version:2,updated_at:feedback.created_at}
  return {items:[{id:'article-fixture',title:articles[0].title,slug:articles[0].slug,status:'draft',version:2,updated_at:feedback.created_at}],total:1}
 })
 const host=await render(<ArticlesPage/>)
 await click(host,'Edit')
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 expect(mock.request).toHaveBeenCalledWith('/admin/articles/article-fixture','PATCH',{content:{...articles[0],sources:articles[0].sources??[]},version:2},undefined,identity.id)
})

describe('CMS public transition',()=>{
 it('does not fallback to local published content when enabled CMS fails',async()=>{
  vi.stubEnv('VITE_EDUCATION_SOURCE','cms')
  vi.resetModules()
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('offline'))
  const {useEducation:useCms}=await import('../src/features/education/useEducation')
  function Probe(){const r=useCms();return <p>{r.error||r.items.map(a=>a.slug).join(',')}</p>}
  const host=await render(<Probe/>)
  expect(host.textContent).toContain('belum dapat dimuat')
  expect(host.textContent).not.toContain(articles[0].title)
  fetch.mockRestore()
 })
 it('keeps original source until explicitly activated',async()=>{
  function Probe(){const r=useEducation();return <p>{r.items.length} original articles</p>}
  const host=await render(<Probe/>)
  expect(host.textContent).toContain('4 original articles')
 })
})
