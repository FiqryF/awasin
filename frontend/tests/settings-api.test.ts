import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accountRequest, parsePreferences, savePreferences } from '../src/features/settings/api'

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
