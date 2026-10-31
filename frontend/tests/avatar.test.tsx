import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { avatarStorage, prepareAvatar, useAvatar } from '../src/features/settings/avatar'

const mocks=vi.hoisted(()=>({session:vi.fn(),list:vi.fn(),download:vi.fn(),upload:vi.fn(),remove:vi.fn()}))
vi.mock('../src/features/auth/client',()=>({requireSupabase:()=>({auth:{getSession:mocks.session},storage:{from:()=>({list:mocks.list,download:mocks.download,upload:mocks.upload,remove:mocks.remove})}})}))
let cleanup:(()=>void)|undefined
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 vi.clearAllMocks()
 mocks.session.mockResolvedValue({data:{session:{user:{id:'owner'}}},error:null})
 mocks.list.mockResolvedValue({data:[],error:null})
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
