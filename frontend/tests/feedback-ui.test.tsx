import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '../src/features/auth/context'
import { FeedbackPage } from '../src/pages/FeedbackPage'
import { feedbackCategories } from '../src/features/feedback/feedbackModel'

const mock=vi.hoisted(()=>({send:vi.fn()}))
vi.mock('../src/features/feedback/api',()=>({submitFeedback:mock.send}))
const receipt='11111111-1111-4111-8111-111111111111'
const identity={id:'owner',email:'fixture@example.invalid',role:'user' as const,aal:'aal1' as const,profile:{id:'owner',display_name:'Fixture'}}
let cleanup:(()=>void)|undefined
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.clearAllMocks()
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})))
 Element.prototype.scrollIntoView=vi.fn();mock.send.mockResolvedValue(receipt)
})
afterEach(async()=>{if(cleanup)await act(async()=>cleanup?.());cleanup=undefined;vi.unstubAllGlobals()})
async function render(authenticated=false,entry:unknown=null,loading=false,error=''){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 await act(async()=>root.render(<AuthContext.Provider value={{identity:authenticated?identity:null,loading,error,refresh:async()=>null}}><MemoryRouter initialEntries={[{pathname:'/feedback',state:entry}]}><FeedbackPage/></MemoryRouter></AuthContext.Provider>))
 cleanup=()=>{root.unmount();host.remove()};return host
}
async function click(element:Element){await act(async()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}))})}
function button(host:ParentNode,text:string){return [...host.querySelectorAll('button')].find(item=>item.textContent?.includes(text))!}
async function fill(element:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}))})}
async function complete(host:HTMLElement){
 const select=host.querySelector<HTMLSelectElement>('select')
 if(select)await act(async()=>{select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}))})
 const title=host.querySelector<HTMLInputElement>('#feedback-title');if(title)await fill(title,'Fixture title')
 await fill(host.querySelector('#feedback-description')!,'Fixture text only, not real user feedback.')
 await click(host.querySelector('#feedback-privacy')!)
 await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
}
it.each(feedbackCategories)('completes the actual $id progressive flow only after a backend receipt',async category=>{
 const host=await render();await click(button(host,category.title));await complete(host)
 expect(mock.send).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Sudah sesuai')
 await click(button(host,'Kirim Feedback'))
 expect(mock.send).toHaveBeenCalledTimes(1)
 expect(host.textContent).toContain('Masukan telah diterima.')
 expect(host.textContent).toContain(receipt)
 expect(document.activeElement).toBe(host.querySelector('.feedback-step-header h2'))
 expect(host.textContent).not.toContain('Fixture text only')
 await click(button(host,'Kirim masukan lain'))
 expect(host.textContent).toContain('Apa yang ingin kamu sampaikan?')
})
it('requires privacy consent and focuses invalid fields before review',async()=>{
 const host=await render();await click(button(host,'Feedback Lainnya'))
 await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
 expect(host.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0)
 expect(button(host,'Kirim Feedback')).toBeUndefined()
 expect(mock.send).not.toHaveBeenCalled()
})
it('retains a failed draft and blocks duplicate submissions while pending',async()=>{
 const host=await render();await click(button(host,'Feedback Lainnya'));await complete(host)
 let reject!: (error:Error)=>void
 mock.send.mockImplementationOnce(()=>new Promise((_,failure)=>{reject=failure}))
 await click(button(host,'Kirim Feedback'));await click(button(host,'Mengirim…'))
 expect(mock.send).toHaveBeenCalledTimes(1)
 await act(async()=>reject(new Error('Layanan belum tersedia.')))
 expect(host.querySelector('[role="alert"]')?.textContent).toContain('belum tersedia')
 expect(host.textContent).not.toContain('Masukan telah diterima.')
 await click(button(host,'Kembali & Edit'))
 expect(host.querySelector<HTMLTextAreaElement>('#feedback-description')?.value).toContain('Fixture text only')
})
it('preselects authenticated detection references but never attaches one to guest feedback',async()=>{
 const host=await render(true,{feedbackCategory:'detection',scanReference:receipt})
 expect(host.querySelector<HTMLInputElement>('#feedback-scanReference')?.value).toBe(receipt)
 expect(host.querySelector('a[aria-label="Kembali ke beranda"]')?.getAttribute('href')).toBe('/dashboard')
 expect(host.textContent).toContain('Masukan ini dihubungkan dengan akun saya')
})
it('waits for identity resolution before inviting guest input',async()=>{
 const host=await render(false,null,true)
 expect(host.querySelector('output')?.textContent).toContain('Memverifikasi sesi')
 expect(host.querySelector('.feedback-categories')).toBeNull()
 expect(mock.send).not.toHaveBeenCalled()
})
it('offers session recovery instead of silently treating an invalid session as a guest',async()=>{
 const host=await render(false,null,false,'Unavailable identity')
 expect(host.querySelector('[role="alert"]')?.textContent).toContain('belum dapat diverifikasi')
 expect(host.querySelector('a[href="/login"]')).not.toBeNull()
 expect(host.querySelector('.feedback-categories')).toBeNull()
})
