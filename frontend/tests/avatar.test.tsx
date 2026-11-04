import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { avatarStorage, prepareAvatar, useAvatar } from '../src/features/settings/avatar'
import { ProfileMenu } from '../src/components/layout/ProfileMenu'
import { AuthContext } from '../src/features/auth/context'
import { MemoryRouter } from 'react-router'

vi.mock('../src/features/auth/useLogout',()=>({useLogout:()=>vi.fn()}))

const mocks=vi.hoisted(()=>({session:vi.fn(),list:vi.fn(),download:vi.fn(),upload:vi.fn(),remove:vi.fn()}))
vi.mock('../src/features/auth/client',()=>({requireSupabase:()=>({auth:{getSession:mocks.session},storage:{from:()=>({list:mocks.list,download:mocks.download,upload:mocks.upload,remove:mocks.remove})}})}))
let cleanup:(()=>void)|undefined
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 vi.clearAllMocks()
 mocks.session.mockResolvedValue({data:{session:{user:{id:'owner'}}},error:null})
 mocks.list.mockResolvedValue({data:[],error:null})
 let serial=0
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=>`blob:avatar-${++serial}`),revokeObjectURL:vi.fn()}))
})

function processedPhoto() {
 vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:100,height:100,close:vi.fn()})))
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D)
 vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(new Blob(['new'],{type:'image/jpeg'})))
 return new File(['photo'],'photo.png',{type:'image/png'})
}

async function integration() {
 let avatar!:ReturnType<typeof useAvatar>
 function Settings({owner}:{owner:string}) { avatar=useAvatar(owner); return null }
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 cleanup=()=>{root.unmount();host.remove()}
 const render=async(owner='owner')=>act(async()=>{
  const identity=owner?{id:owner,email:`${owner}@example.invalid`,role:'user' as const,aal:'aal1' as const,profile:{id:owner,display_name:'Pengguna'}}:null
  root.render(<AuthContext.Provider value={{identity,loading:false,error:'',refresh:vi.fn()}}><MemoryRouter><ProfileMenu/><Settings owner={owner}/></MemoryRouter></AuthContext.Provider>)
 })
 await render()
 return {host,render,avatar:()=>avatar}
}

it('synchronizes upload, replacement and deletion to the real menu without another download',async()=>{
 const file=processedPhoto()
 mocks.upload.mockResolvedValue({data:{},error:null})
 mocks.remove.mockResolvedValue({data:[{name:'owner/avatar.jpg'}],error:null})
 const app=await integration()
 const image=()=>app.host.querySelector('.profile-menu-avatar img')
 expect(image()).toBeNull()
 await act(async()=>{expect(await app.avatar().save(file)).toBe(true)})
 expect(image()?.getAttribute('src')).toMatch(/^blob:/)
 const first=image()!.getAttribute('src')
 await act(async()=>{expect(await app.avatar().save(file)).toBe(true)})
 expect(image()?.getAttribute('src')).not.toBe(first)
 expect(URL.revokeObjectURL).toHaveBeenCalledWith(first)
 expect(mocks.download).not.toHaveBeenCalled()
 await act(async()=>app.host.querySelector('button')!.click())
 expect(app.host.querySelector('#profile-actions a')?.getAttribute('href')).toBe('/settings')
 await act(async()=>{expect(await app.avatar().save(null)).toBe(true)})
 expect(image()).toBeNull()
})

it('loads private storage after remount and does not reuse a revoked photo on logout/login',async()=>{
 mocks.list.mockResolvedValue({data:[{name:'avatar.jpg'}],error:null})
 mocks.download.mockResolvedValue({data:new Blob(['old']),error:null})
 const app=await integration()
 const old=app.host.querySelector('img')!.getAttribute('src')
 expect(mocks.download).toHaveBeenCalledWith('owner/avatar.jpg',expect.objectContaining({cacheNonce:expect.any(String)}), {cache:'no-store'})
 await app.render('')
 expect(app.host.querySelector('img')).toBeNull()
 mocks.list.mockReturnValue(new Promise(()=>{}))
 await app.render()
 expect(app.host.querySelector('img')).toBeNull()
 expect(URL.revokeObjectURL).toHaveBeenCalledWith(old)
})

it('ignores old downloads after switching accounts',async()=>{
 mocks.list.mockResolvedValue({data:[{name:'avatar.jpg'}],error:null})
 let resolve!:(value:unknown)=>void
 mocks.download.mockReturnValue(new Promise(done=>{resolve=done}))
 const app=await integration()
 mocks.session.mockResolvedValue({data:{session:{user:{id:'other'}}},error:null})
 mocks.list.mockResolvedValue({data:[],error:null})
 await app.render('other')
 await act(async()=>resolve({data:new Blob(['old']),error:null}))
 expect(app.host.querySelector('img')).toBeNull()
})

it('does not announce a successful mutation after the session changes during upload',async()=>{
 const file=processedPhoto()
 let resolve!:(value:unknown)=>void
 mocks.upload.mockReturnValue(new Promise(done=>{resolve=done}))
 const app=await integration()
 let saved:Promise<boolean|undefined>
 await act(async()=>{saved=app.avatar().save(file)})
 mocks.session.mockResolvedValue({data:{session:{user:{id:'other'}}},error:null})
 await act(async()=>resolve({data:{},error:null}))
 expect(await saved!).toBe(false)
 expect(app.host.querySelector('img')).toBeNull()
})

it('keeps the current menu photo when replacement fails and falls back on image decoding errors',async()=>{
 mocks.list.mockResolvedValue({data:[{name:'avatar.jpg'}],error:null})
 mocks.download.mockResolvedValue({data:new Blob(['old']),error:null})
 const app=await integration()
 const previous=app.host.querySelector('img')!.getAttribute('src')
 mocks.upload.mockResolvedValue({error:{message:'access denied'},data:null})
 const file=processedPhoto()
 await act(async()=>{expect(await app.avatar().save(file)).toBe(false)})
 expect(app.host.querySelector('img')?.getAttribute('src')).toBe(previous)
 await act(async()=>app.host.querySelector('img')!.dispatchEvent(new Event('error')))
 expect(app.host.querySelector('img')).toBeNull()
})

it('does not let an initial stale download overwrite the uploaded photo',async()=>{
 mocks.list.mockResolvedValue({data:[{name:'avatar.jpg'}],error:null})
 const pending:Array<(value:unknown)=>void>=[]
 mocks.download.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)))
 mocks.upload.mockResolvedValue({data:{},error:null})
 const app=await integration()
 const file=processedPhoto()
 await act(async()=>{expect(await app.avatar().save(file)).toBe(true)})
 const uploaded=app.host.querySelector('img')!.getAttribute('src')
 await act(async()=>pending.forEach(resolve=>resolve({data:new Blob(['old']),error:null})))
 expect(app.host.querySelector('img')?.getAttribute('src')).toBe(uploaded)
})

it('reloads the saved avatar from private storage on a fresh mount',async()=>{
 mocks.list.mockResolvedValue({data:[{name:'avatar.jpg'}],error:null})
 mocks.download.mockResolvedValue({data:new Blob(['persisted']),error:null})
 const first=await integration()
 const url=first.host.querySelector('img')!.getAttribute('src')
 await act(async()=>cleanup?.())
 const second=await integration()
 expect(second.host.querySelector('img')?.getAttribute('src')).not.toBe(url)
 expect(mocks.download).toHaveBeenCalledTimes(4)
 expect(new Set(mocks.download.mock.calls.map(call=>call[1]?.cacheNonce)).size).toBe(4)
 expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
})

it('shows a safe error for storage failures and invalid image decoding',async()=>{
 mocks.list.mockResolvedValue({data:null,error:{message:'private internal storage detail'}})
 const app=await integration()
 expect(app.host.querySelector('img')).toBeNull()
 expect(app.avatar().error).toContain('belum dapat dimuat')
 expect(app.avatar().error).not.toContain('private internal')
 vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('decoder internal detail')))
 await act(async()=>{expect(await app.avatar().save(new File(['broken'],'photo.jpg',{type:'image/jpeg'}))).toBe(false)})
 expect(app.avatar().error).toContain('Foto tidak dapat dibaca')
 expect(mocks.upload).not.toHaveBeenCalled()
})
afterEach(async()=>{if(cleanup)await act(async()=>cleanup?.());cleanup=undefined;vi.restoreAllMocks();vi.unstubAllGlobals()})
it('rejects avatar operations after an account change',async()=>{
 await expect(avatarStorage('other-owner')).rejects.toThrow('Akun aktif telah berubah')
 expect(mocks.list).not.toHaveBeenCalled()
})
it('rejects unsupported and oversized photos before decoding',async()=>{
 await expect(prepareAvatar(new File(['svg'],'photo.svg',{type:'image/svg+xml'}))).rejects.toThrow('maksimal 2 MB')
 await expect(prepareAvatar(new File([new Uint8Array(2*1024*1024+1)],'photo.jpg',{type:'image/jpeg'}))).rejects.toThrow('maksimal 2 MB')
})
it('does not claim deletion succeeded when storage did not delete the owner photo',async()=>{
 let avatar:ReturnType<typeof useAvatar>|undefined
 function Probe(){avatar=useAvatar('owner');return null}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 cleanup=()=>{root.unmount();host.remove()}
 await act(async()=>root.render(<Probe/>))
 mocks.remove.mockResolvedValue({data:[],error:null})
 let result:boolean|undefined
 await act(async()=>{result=await avatar!.save(null)})
 expect(result).toBe(false)
 expect(avatar!.error).toContain('belum berhasil dihapus')
 expect(mocks.remove).toHaveBeenCalledWith(['owner/avatar.jpg'])
})
it('re-encodes a photo and reports upload errors without claiming success',async()=>{
 const close=vi.fn()
 vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:100,height:100,close})))
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillStyle:'',fillRect:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D)
 vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(new Blob(['jpg'],{type:'image/jpeg'})))
 let avatar:ReturnType<typeof useAvatar>|undefined
 function Probe(){avatar=useAvatar('owner');return null}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 cleanup=()=>{root.unmount();host.remove()}
 await act(async()=>root.render(<Probe/>))
 mocks.upload.mockResolvedValue({data:null,error:{message:'bucket missing'}})
 let result:boolean|undefined
 await act(async()=>{result=await avatar!.save(new File(['photo'],'photo.png',{type:'image/png'}))})
 expect(result).toBe(false)
 expect(avatar!.error).toContain('Foto belum tersimpan')
 expect(mocks.upload).toHaveBeenCalledWith('owner/avatar.jpg',expect.any(Blob),expect.objectContaining({upsert:true,contentType:'image/jpeg'}))
 expect(close).toHaveBeenCalled()
})
