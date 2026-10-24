import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { submitFeedback } from '../src/features/feedback/api'
import { emptyFeedback, type FeedbackCategory } from '../src/features/feedback/feedbackModel'

const mock=vi.hoisted(()=>({session:vi.fn()}))
vi.mock('../src/features/auth/client',()=>({supabase:{auth:{getSession:mock.session}}}))
const receipt='11111111-1111-4111-8111-111111111111'
beforeEach(()=>mock.session.mockResolvedValue({data:{session:null},error:null}))
afterEach(()=>vi.unstubAllGlobals())
it.each(['detection','bug','idea','other'] as FeedbackCategory[])('sends consented %s text without file data or arbitrary identity',async category=>{
 const draft={...emptyFeedback,description:'Fixture feedback for validation.',privacy:true,errorType:'Hasil analisis tidak sesuai / lainnya',feature:'Login/Register',title:'Fixture title'}
 const fetcher=vi.fn(async(url:string,init:RequestInit)=>{expect(url).toContain('/api/v1/feedback');expect(init.method).toBe('POST');return Response.json({receipt_id:receipt})})
 vi.stubGlobal('fetch',fetcher)
 expect(await submitFeedback(category,draft,receipt,null,new AbortController().signal)).toBe(receipt)
 const body=JSON.parse(String(fetcher.mock.calls[0][1].body))
 expect(body.category).toBe(category);expect(body.consent).toBe(true)
 expect(body).not.toHaveProperty('owner_id');expect(body).not.toHaveProperty('file');expect(body).not.toHaveProperty('password')
 expect(body.fields).toHaveProperty('description',draft.description)
 if(category!=='bug')expect(body.fields).not.toHaveProperty('feature')
})
it('never silently submits as another user after an account switch',async()=>{
 mock.session.mockResolvedValueOnce({data:{session:{access_token:'fixture',user:{id:'other'}}},error:null})
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
 await expect(submitFeedback('other',{...emptyFeedback,description:'Fixture description',privacy:true},receipt,'owner',new AbortController().signal)).rejects.toThrow('berubah')
 expect(fetcher).not.toHaveBeenCalled()
})
it.each([429,503,404,422])('shows HTTP %i as failure, never as a receipt',async status=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('private-provider-error',{status})))
 await expect(submitFeedback('other',{...emptyFeedback,description:'Fixture description',privacy:true},receipt,null,new AbortController().signal)).rejects.not.toThrow('private-provider-error')
})
it('rejects a malformed server confirmation instead of inventing an ID',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({receipt_id:'fake'})))
 await expect(submitFeedback('other',{...emptyFeedback,description:'Fixture description',privacy:true},receipt,null,new AbortController().signal)).rejects.toThrow('tidak valid')
})
