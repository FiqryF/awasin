import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { RouteAnnouncer } from '../src/components/common/RouteAnnouncer'
import { RouteBoundary } from '../src/components/common/RouteBoundary'
import { Footer } from '../src/components/layout/Footer'
import { FloatingNavbar } from '../src/components/layout/FloatingNavbar'
import { AuthContext } from '../src/features/auth/context'

let cleanup:(()=>void)|undefined
beforeEach(()=>{
 vi.stubGlobal('ResizeObserver',class { observe() {} disconnect() {} })
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})))
 window.scrollTo=vi.fn();Element.prototype.scrollIntoView=vi.fn()
 HTMLDialogElement.prototype.showModal=function(){this.open=true}
 HTMLDialogElement.prototype.close=function(){this.open=false}
})
afterEach(async()=>{if(cleanup)await act(async()=>cleanup?.());cleanup=undefined;vi.restoreAllMocks();vi.unstubAllGlobals()})
async function render(content:ReactNode,path='/education/phishing'){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 const draw=(next:ReactNode)=>root.render(<MemoryRouter initialEntries={[path]}>{next}</MemoryRouter>)
 await act(async()=>draw(content));cleanup=()=>{root.unmount();host.remove()}
 return {host,draw:async(next:ReactNode)=>{await act(async()=>draw(next))}}
}
async function click(element:Element){await act(async()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}))})}
it('provides safe route-error recovery without displaying internal exception details',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{})
 function Failure():never{throw new Error('private-fixture-error')}
 const {host,draw}=await render(<RouteBoundary resetKey="first"><Failure/></RouteBoundary>)
 expect(host.textContent).toContain('Halaman belum dapat dibuka.')
 expect(host.textContent).not.toContain('private-fixture-error')
 expect(host.querySelector('button')?.textContent).toBe('Muat ulang halaman')
 await draw(<RouteBoundary resetKey="second"><p>Recovered content</p></RouteBoundary>)
 expect(host.textContent).toBe('Recovered content')
})
it('announces headings arriving after a lazy loading placeholder',async()=>{
 function Delayed(){const [ready,setReady]=useState(false);return <><RouteAnnouncer/><main id="main-content"><button onClick={()=>setReady(true)}>Load fixture</button>{ready?<h1>Halaman siap dibaca</h1>:<p>Memuat…</p>}</main></>}
 const {host}=await render(<Delayed/>)
 await click(host.querySelector('button')!)
 expect(document.title).toBe('Halaman siap dibaca | AWASIN')
 expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe('Halaman siap dibaca')
})
it('makes privacy readable from the shared footer and restores focus after closing',async()=>{
 const {host}=await render(<Footer/>)
 const trigger=host.querySelector('button')!;trigger.focus();await click(trigger)
 expect(document.querySelector('dialog')?.open).toBe(true)
 expect(document.querySelector('dialog')?.textContent).toContain('bergantung pada aktivasi layanan')
 await click(document.querySelector('button[aria-label="Tutup dokumen"]')!)
 expect(document.querySelector('dialog')).toBeNull()
 expect(document.activeElement).toBe(trigger)
})
it('uses authenticated footer destinations without adding a top-level Privacy action',async()=>{
 const identity={id:'fixture',email:'fixture@example.invalid',role:'user' as const,aal:'aal1' as const,profile:{id:'fixture',display_name:'Fixture'}}
 const {host}=await render(<AuthContext.Provider value={{identity,loading:false,error:'',refresh:async()=>identity}}><Footer/></AuthContext.Provider>)
 expect(host.querySelector('a[href="/dashboard#beranda"]')).not.toBeNull()
 expect(host.querySelector('a[href="/settings"]')?.textContent).toBe('Pengaturan Akun')
 expect(host.querySelector('a[href="/login"]')).toBeNull()
})
it('keeps Education active on article routes in the original navbar',async()=>{
 const {host}=await render(<FloatingNavbar/>)
 const link=host.querySelector('.desktop-nav a[href="/education"]')
 expect(link?.getAttribute('aria-current')).toBe('page')
 expect(host.querySelector('.nav-active-pill')?.getAttribute('data-active')).toBe('edukasi')
})
it.each([false,true])('keeps one shared capsule across home, Education and History (signed in: %s)',async(signedIn)=>{
 const identity=signedIn?{id:'fixture',email:'fixture@example.invalid',role:'user' as const,aal:'aal1' as const,profile:{id:'fixture',display_name:'Fixture'}}:null
 const home=signedIn?'/dashboard':'/'
 const {host}=await render(<AuthContext.Provider value={{identity,loading:false,error:'',refresh:async()=>identity}}><FloatingNavbar/></AuthContext.Provider>,home)
 const header=host.querySelector('header')
 const capsule=host.querySelector('.nav-active-pill')
 expect(host.querySelectorAll('.nav-active-pill')).toHaveLength(1)
 await click(host.querySelector('.desktop-nav a[href="/education"]')!)
 expect(host.querySelector('.nav-active-pill')).toBe(capsule)
 expect(host.querySelectorAll('.nav-active-pill')).toHaveLength(1)
 expect(host.querySelector('.nav-active-pill')?.getAttribute('data-active')).toBe('edukasi')
 if(signedIn){
  await click(host.querySelector('.desktop-nav a[href="/history"]')!)
  expect(host.querySelectorAll('.nav-active-pill')).toHaveLength(1)
  expect(host.querySelector('.nav-active-pill')?.getAttribute('data-active')).toBe('history')
 }
 await click(host.querySelector(`.desktop-nav a[href="${home}#beranda"]`)!)
 expect(host.querySelectorAll('.nav-active-pill')).toHaveLength(1)
 expect(host.querySelector('header')).toBe(header)
})
it('keeps the dark glass theme on a refreshed Education route even when main starts below the header',async()=>{
 const frame=vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{callback(0);return 1})
 const {host}=await render(<><FloatingNavbar/><main id="main-content" data-nav-theme="dark"/></>,'/education')
 expect(host.querySelector('.floating-header')?.getAttribute('data-theme')).toBe('dark')
 frame.mockRestore()
})
