import { useEffect, useState } from 'react'
import { articles as originals } from './articles'
import { API_BASE_URL } from '../../services/api'

export type Article = { slug: string; title: string; description: string; category: string; action: string; image: string; sections: readonly { title: string; paragraphs: readonly string[] }[]; source: { name: string; url: string }; sources?: readonly { name: string; url: string }[] }
export const cmsEnabled = import.meta.env.VITE_EDUCATION_SOURCE === 'cms'

// Opt in only after the seed equivalence check succeeds on the target cloud.
// Once opted in, errors never resurrect archived/draft local content.
export function useEducation(slug?: string) {
  const [revision, setRevision] = useState(0)
  const [offset, setOffset] = useState(0)
  const [state, setState] = useState<{ key: string; items?: Article[]; error?: string }>({ key: '' })
  const key = `${slug ?? ''}:${revision}:${offset}`
  useEffect(() => {
    if (!cmsEnabled) return
    const controller = new AbortController()
    const path = slug ? `/education/${encodeURIComponent(slug)}` : `/education?offset=${offset}&limit=50`
    void fetch(`${API_BASE_URL}/api/v1${path}`, { signal: AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]), cache: 'no-store', credentials: 'omit' }).then(async response => {
      if (response.status === 404 && slug) return []
      if (!response.ok) throw new Error('Materi edukasi belum dapat dimuat. Silakan coba lagi.')
      const data = await response.json()
      if (slug) return [data]
      // Preserve the four original editorial positions without reviving absent rows.
      const rank = (value: Article) => { const index = originals.findIndex(item => item.slug === value.slug); return index < 0 ? originals.length : index }
      return [...data.items].sort((a: Article,b: Article) => rank(a)-rank(b))
    }).then((items: Article[]) => { if (!controller.signal.aborted) setState({ key, items }) }).catch(() => { if (!controller.signal.aborted) setState({ key, error: 'Materi edukasi belum dapat dimuat. Silakan coba lagi.' }) })
    return () => controller.abort()
  }, [key, offset, slug])
  if (!cmsEnabled) return { items: (slug ? originals.filter(item => item.slug === slug) : originals) as readonly Article[], error: '', loading: false, reload: () => {}, next: undefined, previous: undefined }
  const items = state.key === key ? state.items : undefined
  return { items: items ?? [], error: state.key === key ? state.error ?? '' : '', loading: !items && !(state.key === key && state.error), reload: () => setRevision(v => v + 1), next: !slug && items?.length === 50 ? () => setOffset(v => v + 50) : undefined, previous: !slug && offset > 0 ? () => setOffset(v => Math.max(0,v - 50)) : undefined }
}
