import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accountExport, accountRequest, parsePreferences, savePreferences } from '../src/features/settings/api'

const mock=vi.hoisted(()=>({session:vi.fn()}))
vi.mock('../src/features/auth/client',()=>({requireSupabase:()=>({auth:{getSession:mock.session}})}))
beforeEach(()=>mock.session.mockResolvedValue({data:{session:{access_token:'fixture-token',user:{id:'owner-a'}}},error:null}))
afterEach(()=>vi.unstubAllGlobals())
it('blocks pending settings mutations when the active account has changed',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
 await expect(accountRequest('/profiles/me','PATCH',{display_name:'A'},undefined,'owner-b')).rejects.toThrow('berubah')
 expect(fetcher).not.toHaveBeenCalled()
})
it('sends only the supported preference fields with the verified account token',async()=>{
 const preferences={history_retention:'disabled' as const,animation:'reduced' as const}
 const fetcher=vi.fn(async (url:string,options:RequestInit)=>{expect(url).toContain('/account/preferences');expect(options.method).toBe('PATCH');return Response.json(preferences)});vi.stubGlobal('fetch',fetcher)
 expect(await savePreferences(preferences,'owner-a')).toEqual(preferences)
 const [url,init]=fetcher.mock.calls[0]
 expect(url).toContain('/api/v1/account/preferences')
 expect(JSON.parse(String(init.body))).toEqual(preferences)
 expect(init.headers).toMatchObject({Authorization:'Bearer fixture-token'})
 expect(init.cache).toBe('no-store')
})
it('reports service failure instead of inventing a saved preference',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('private SQL error',{status:503})))
 await expect(savePreferences({history_retention:'manual',animation:'system'},'owner-a')).rejects.not.toThrow('private SQL')
 expect(()=>parsePreferences({history_retention:'automatic',animation:'system'})).toThrow()
})
it('exports only a response matching the still-active owner',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({format_version:2,profile:{id:'owner-a'},saved_reports:[],feedback:[]})))
 const blob=await accountExport('owner-a',new AbortController().signal)
 expect(blob.type).toBe('application/json')
 expect(blob.size).toBeGreaterThan(0)
})
it('rejects an export response for another owner',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({format_version:2,profile:{id:'owner-b'}})))
 await expect(accountExport('owner-a',new AbortController().signal)).rejects.toThrow('tidak valid')
})
it('rejects account switching while export is in flight',async()=>{
 mock.session.mockResolvedValueOnce({data:{session:{access_token:'fixture-token',user:{id:'owner-a'}}},error:null})
 mock.session.mockResolvedValueOnce({data:{session:{user:{id:'owner-b'}}},error:null})
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({format_version:2,profile:{id:'owner-a'}})))
 await expect(accountExport('owner-a',new AbortController().signal)).rejects.toThrow('dibatalkan')
})
it('does not export after its page request was aborted',async()=>{
 const controller=new AbortController()
 vi.stubGlobal('fetch',vi.fn(async()=>{controller.abort();return Response.json({format_version:2,profile:{id:'owner-a'}})}))
 await expect(accountExport('owner-a',controller.signal)).rejects.toThrow('dibatalkan')
})
it('distinguishes oversized writes from the export record limit',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:413})))
 await expect(accountRequest('/admin/articles','POST',{})).rejects.toThrow('Ukuran permintaan')
 await expect(accountRequest('/account/export')).rejects.toThrow('500 laporan')
})
