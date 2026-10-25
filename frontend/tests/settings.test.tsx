import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '../src/features/auth/context'
import { PreferencesContext } from '../src/features/settings/context'
import { PreferencesProvider } from '../src/features/settings/PreferencesProvider'
import { SettingsPage } from '../src/pages/SettingsPage'
import { changeAccountPassword } from '../src/features/settings/changePassword'
import { usePrefersReducedMotion } from '../src/hooks/usePrefersReducedMotion'
import { SaveReportAction } from '../src/features/history/SaveReportAction'
import type { ReportDetail } from '../src/features/history/contracts'

const mock=vi.hoisted(()=>({request:vi.fn(),read:vi.fn(),save:vi.fn(),update:vi.fn(),refresh:vi.fn(),signIn:vi.fn(),updateUser:vi.fn(),signOut:vi.fn()}))
vi.mock('../src/features/settings/api',async original=>({...await original<object>(),accountRequest:mock.request,getPreferences:mock.read,savePreferences:mock.save}))
vi.mock('../src/features/auth/client',()=>({reauthenticationClient:()=>({auth:{signInWithPassword:mock.signIn,updateUser:mock.updateUser,signOut:mock.signOut}}),requireSupabase:()=>({auth:{signOut:mock.signOut,getSession:async()=>({data:{session:null},error:null})}})}))
const identity={id:'fixture-owner',email:'fixture@example.invalid',role:'user' as const,aal:'aal1' as const,profile:{id:'fixture-owner',display_name:'Nama Fixture'}}
let cleanup:(()=>void)|undefined
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 vi.clearAllMocks()
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn()})))
 mock.signIn.mockResolvedValue({data:{user:{id:identity.id},session:{}},error:null})
 mock.updateUser.mockResolvedValue({error:null});mock.signOut.mockResolvedValue({error:null})
 mock.read.mockResolvedValue({history_retention:'manual',animation:'system'})
 mock.save.mockImplementation(async value=>value)
 mock.refresh.mockResolvedValue(identity)
})
afterEach(async()=>{if(cleanup)await act(async()=>cleanup?.());cleanup=undefined;vi.unstubAllGlobals();delete document.documentElement.dataset.accountMotion})
async function render(path='/settings',content=<SettingsPage/>) {
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 await act(async()=>root.render(<AuthContext.Provider value={{identity,loading:false,error:'',refresh:mock.refresh}}><PreferencesContext.Provider value={{value:{history_retention:'manual',animation:'system'},error:'',update:mock.update,reload:vi.fn()}}><MemoryRouter initialEntries={[path]}>{content}</MemoryRouter></PreferencesContext.Provider></AuthContext.Provider>))
 cleanup=()=>{root.unmount();host.remove()};return host
}
async function click(element:Element){await act(async()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}))})}
function button(host:ParentNode,text:string){return [...host.querySelectorAll('button')].find(item=>item.textContent?.includes(text))!}
async function input(element:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}))})}

it('shows actual identity, read-only email and all four functional categories',async()=>{
 const host=await render()
 expect(host.querySelector<HTMLInputElement>('#settings-name')?.value).toBe(identity.profile.display_name)
 expect(host.querySelector<HTMLInputElement>('#settings-email')?.readOnly).toBe(true)
 for(const [label,heading] of [['Keamanan Akun','Jaga akses tetap milikmu.'],['Privasi & Data','Datamu, pilihanmu.'],['Preferensi','Nyaman digunakan, sesuai kebutuhanmu.'],['Profil Saya','Identitas yang kamu gunakan.']]){
  await click(button(host,label));expect(host.querySelector('h2')?.textContent).toBe(heading)
 }
})
it('preserves profile input on failure and refreshes global identity after confirmed saving',async()=>{
 const host=await render();await input(host.querySelector('#settings-name')!,'  Nama Baru  ')
 mock.request.mockRejectedValueOnce(new Error('Belum tersimpan.'))
 await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
 expect(host.querySelector<HTMLInputElement>('#settings-name')?.value).toBe('  Nama Baru  ')
 expect(host.querySelector('[role="alert"]')?.textContent).toBe('Belum tersimpan.')
 expect(mock.refresh).not.toHaveBeenCalled()
 mock.request.mockResolvedValueOnce({id:identity.id,display_name:'Nama Baru'})
 await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
 expect(mock.request).toHaveBeenLastCalledWith('/profiles/me','PATCH',{display_name:'Nama Baru'},undefined,identity.id)
 expect(mock.refresh).toHaveBeenCalledTimes(1)
 expect(host.querySelector('output')?.textContent).toContain('berhasil disimpan')
})
it('persists explicit privacy choices and keeps account deletion unavailable',async()=>{
 const host=await render('/settings?section=privacy')
 const select=host.querySelector<HTMLSelectElement>('#settings-history')!
 await act(async()=>{select.value='disabled';select.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(mock.update).toHaveBeenCalledWith({history_retention:'disabled',animation:'system'})
 expect(button(host,'Penghapusan akun belum tersedia').disabled).toBe(true)
 expect(host.querySelector('dialog')).toBeNull()
 expect(mock.request).not.toHaveBeenCalled()
})
it('requires valid matching passwords before contacting the provider',async()=>{
 await expect(changeAccountPassword(identity,'fixture-current','short','short')).rejects.toThrow('Minimal 8')
 await expect(changeAccountPassword(identity,'fixture-current','fixture-new-password','mismatch')).rejects.toThrow()
 expect(mock.signIn).not.toHaveBeenCalled()
})
it('requires successful provider reauthentication and checks the verified account ID',async()=>{
 mock.signIn.mockResolvedValueOnce({data:{session:null,user:null},error:{}})
 await expect(changeAccountPassword(identity,'fixture-current','fixture-new-password','fixture-new-password')).rejects.toThrow('Verifikasi')
 mock.signIn.mockResolvedValueOnce({data:{session:{},user:{id:'other-user'}},error:null})
 await expect(changeAccountPassword(identity,'fixture-current','fixture-new-password','fixture-new-password')).rejects.toThrow('Verifikasi')
 expect(mock.updateUser).not.toHaveBeenCalled()
})
it('uses the verified provider session and never turns provider rejection into success',async()=>{
 mock.updateUser.mockResolvedValueOnce({error:{code:'weak_password'}})
 await expect(changeAccountPassword(identity,'fixture-current','fixture-new-password','fixture-new-password')).rejects.toThrow('belum diubah')
 await changeAccountPassword(identity,'fixture-current','fixture-new-password','fixture-new-password')
 expect(mock.updateUser).toHaveBeenCalledWith({password:'fixture-new-password',current_password:'fixture-current'})
 expect(mock.signOut).toHaveBeenLastCalledWith({scope:'local'})
})
it('clears password fields only after a confirmed provider update',async()=>{
 const host=await render('/settings?section=security')
 await input(host.querySelector('#settings-current-password')!,'fixture-current')
 await input(host.querySelector('#settings-new-password')!,'fixture-new-password')
 await input(host.querySelector('#settings-confirm-password')!,'fixture-new-password')
 mock.updateUser.mockResolvedValueOnce({error:{code:'weak_password'}})
 await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
 expect(host.querySelector<HTMLInputElement>('#settings-new-password')?.value).toBe('fixture-new-password')
 expect(host.querySelector('output')).toBeNull()
 await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
 expect(host.querySelector<HTMLInputElement>('#settings-current-password')?.value).toBe('')
 expect(host.querySelector<HTMLInputElement>('#settings-new-password')?.value).toBe('')
 expect(host.querySelector('output')?.textContent).toContain('berhasil diubah')
})
it('applies persisted reduced motion to the actual shared motion hook',async()=>{
 mock.read.mockResolvedValueOnce({history_retention:'manual',animation:'reduced'})
 function Probe(){return <p>{usePrefersReducedMotion()?'reduced':'normal'}</p>}
 const host=await render('/settings',<PreferencesProvider><Probe/></PreferencesProvider>)
 expect(host.textContent).toBe('reduced')
 expect(document.documentElement.dataset.accountMotion).toBe('reduced')
})
it('does not offer manual report saving when retention is disabled',async()=>{
 const report={id:'test',status:'completed',saved_at:null} as ReportDetail
 const host=await render('/settings',<PreferencesContext.Provider value={{value:{history_retention:'disabled',animation:'system'},error:'',update:mock.update,reload:vi.fn()}}><SaveReportAction report={report} onSaved={vi.fn()}/></PreferencesContext.Provider>)
 expect(host.textContent).toContain('Penyimpanan laporan baru dinonaktifkan')
 expect(host.querySelector('input[type="checkbox"]')).toBeNull()
})
