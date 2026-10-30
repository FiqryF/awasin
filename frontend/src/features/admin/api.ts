import { useEffect, useRef, useState } from 'react'
import { accountRequest } from '../settings/api'
import { useAuth } from '../auth/useAuth'
import { useAuthNotifications } from '../auth/authNotifications'

export type Page<T> = { items: T[]; total: number }
export type Organization = { id: string; name: string; category: string; description: string; version: number }
export type Domain = { id: string; organization_id: string; domain: string; status: string; evidence_url: string; evidence_description: string; review_note: string; reviewed_by: string | null; verified_at: string | null; version: number; created_at: string }
export type Feedback = { id: string; category: string; status: string; preview: string; version: number; created_at: string; report_id: string | null }
export type FeedbackDetail = Feedback & { fields: Record<string, string>; contact_email: string | null; note: string }
export type Audit = { id: string; action: string; actor_id: string | null; entity_type: string; entity_id: string; created_at: string; metadata: Record<string, unknown> }
export type Overview = { feedback_total: number; feedback_new: number; feedback_in_review: number; feedback_resolved: number; domains_verified: number; domains_pending: number; articles_published: number }
export function auditLabel(action: string) {
  const labels: Record<string,string> = {'feedback_handling.update':'Penanganan Feedback diperbarui','registry_domains.insert':'Kandidat domain ditambahkan','registry_domains.update':'Domain ditinjau atau diperbarui','registry_organizations.insert':'Organisasi ditambahkan','registry_organizations.update':'Organisasi diperbarui','education_articles.insert':'Draf artikel dibuat','education_articles.update':'Artikel atau publikasi diperbarui','education.seed':'Artikel asli diimpor'}
  return labels[action] ?? 'Perubahan administrasi'
}
export function useAdminData<T>(path: string) {
  const { identity } = useAuth()
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  const key = `${identity?.id}:${path}:${revision}`
  useEffect(() => {
    const controller = new AbortController()
    if (identity?.role !== 'admin') return
    void accountRequest(`/admin/${path}`, 'GET', undefined, controller.signal, identity.id).then(data => {
      if (!controller.signal.aborted) setState({ key, data: data as T })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Data belum dapat dimuat.' })
    })
    return () => controller.abort()
  }, [identity?.id, identity?.role, path, key])
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined, reload: () => setRevision(v => v + 1) }
}

export function useAdminMutation() {
  const { identity } = useAuth()
  const { notify } = useAuthNotifications()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function save<T>(path: string, method: string, payload: unknown): Promise<T | undefined> {
    if (lock.current || identity?.role !== 'admin') return
    lock.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await accountRequest(`/admin/${path}`, method, payload, undefined, identity.id) as T
      setMessage('Perubahan tersimpan dan dicatat dalam audit.')
      notify({title:'Perubahan tersimpan',message:'Penyimpanan telah dikonfirmasi dan dicatat dalam audit.',tone:'success'})
      return result
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Perubahan belum tersimpan.')
    } finally { lock.current = false; setBusy(false) }
  }
  return { busy, error, message, save }
}
