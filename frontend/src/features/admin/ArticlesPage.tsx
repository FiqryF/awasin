import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAdminData, useAdminMutation, type Page } from './api'
import { PageHead, State, Status, Pager, DateTime, FeedbackMessage, EditorHead, Confirm } from './ui'
import { cmsEnabled } from '../education/useEducation'
import { articles as defaultArticles } from '../education/articles'
import {
  type ArticleContent,
  type ArticleRecord,
  emptyArticle,
  editorContent,
  articleContent,
  editorSection,
  editorSource,
  editorParagraph,
  generateSlug,
  type EditorContent,
} from './articleTypes'

export type { ArticleContent, ArticleRecord }

const fallbackArticles: ArticleRecord[] = defaultArticles.map(article => ({
  id: `article-${article.slug}`,
  slug: article.slug,
  title: article.title,
  category: article.category,
  status: 'published',
  version: 1,
  updated_at: '2026-10-29T13:24:58.392Z',
  content: {
    ...article,
    sections: article.sections.map(s => ({ title: s.title, paragraphs: [...s.paragraphs] })),
    source: { ...article.source },
    sources: 'sources' in article && Array.isArray((article as unknown as { sources?: { name: string; url: string }[] }).sources) ? [...(article as unknown as { sources: { name: string; url: string }[] }).sources] : []
  }
}))

export function ArticleEditor({ record, close, updated }: Readonly<{ record: ArticleRecord | null; close: () => void; updated: () => void }>) {
  const [content, setContent] = useState(() => editorContent(record?.content ?? emptyArticle))
  const [preview, setPreview] = useState(false)
  const [confirm, setConfirm] = useState('')
  const mutation = useAdminMutation()
  const set = <K extends keyof EditorContent>(key: K, value: EditorContent[K]) => setContent(old => ({ ...old, [key]: value }))
  async function save() {
    const finalSlug = content.slug.trim()
      ? (record ? content.slug : generateSlug(content.slug))
      : generateSlug(content.title)
    const payload = {
      content: {
        ...articleContent(content),
        slug: finalSlug,
      },
      ...(record ? { version: record.version } : {}),
    }
    if (await mutation.save(record ? `articles/${record.id}` : 'articles', record ? 'PATCH' : 'POST', payload)) updated()
  }
  function submit(event: SubmitEvent<HTMLFormElement>) { event.preventDefault(); if (record?.status === 'published') setConfirm('save'); else void save() }
  async function changeStatus() {
    if (!record) return
    if (confirm === 'save') {
      await save()
      return
    }
    if (await mutation.save(`articles/${record.id}/status`, 'POST', { version: record.version, status: confirm })) updated()
  }
  return <section className="admin-editor admin-article-editor"><EditorHead title={record ? 'Editor artikel' : 'Artikel baru'} close={close} /><div className="admin-actions"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Tulis</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Pratinjau</button>{record && <Status value={record.status} />}</div>{preview ? <article className="admin-preview"><p className="admin-preview-category">{content.category}</p><h2>{content.title}</h2><p className="admin-preview-desc">{content.description}</p>{content.sections.map(section => <section key={section.id}><h3>{section.title}</h3>{section.paragraphs.map(paragraph => <p key={paragraph.id}>{paragraph.text}</p>)}</section>)}<h3>Sumber rujukan</h3>{[content.source, ...content.sources].map(source => <p key={source.id}>{source.name} · {source.url}</p>)}<p>Pratinjau internal. Draf belum tersedia untuk publik.</p></article> : <form onSubmit={e => submit(e)}><label>Judul<input required minLength={5} maxLength={200} value={content.title} onChange={e => set('title', e.target.value)} /></label><label>Slug URL {record ? '' : '(opsional)'}<input required={Boolean(record)} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={100} readOnly={Boolean(record)} placeholder={record ? undefined : 'Dibuat otomatis dari judul jika dikosongkan'} value={content.slug} onChange={e => set('slug', e.target.value)} /></label><p className="admin-footnote">{record ? 'Slug tidak dapat diubah setelah dibuat agar URL publik tetap utuh.' : 'Slug URL bersifat opsional. Jika dikosongkan, slug dibuat otomatis dari judul.'}</p><label>Ringkasan<textarea required minLength={10} maxLength={1000} value={content.description} onChange={e => set('description', e.target.value)} /></label><label>Kategori<input required minLength={2} maxLength={80} value={content.category} onChange={e => set('category', e.target.value)} /></label><label>Gambar editorial<select value={content.image} onChange={e => set('image', e.target.value)}>{['phishing', 'message', 'qr', 'media'].map(name => <option key={name} value={`/assets/education/${name}.jpg`}>{name}</option>)}</select></label>{content.sections.map((section, index) => <fieldset key={section.id}><legend>Bagian {index + 1}</legend><label>Judul bagian<input required minLength={2} maxLength={200} value={section.title} onChange={e => set('sections', content.sections.map((value, i) => i === index ? { ...value, title: e.target.value } : value))} /></label><label>Paragraf (pisahkan dengan baris kosong)<textarea required value={section.paragraphs.map(paragraph => paragraph.text).join('\n\n')} maxLength={100000} onChange={e => set('sections', content.sections.map((value, i) => i === index ? { ...value, paragraphs: e.target.value.split('\n\n').map(editorParagraph) } : value))} /></label><button type="button" disabled={content.sections.length <= 1} onClick={() => set('sections', content.sections.filter((_, i) => i !== index))}>Hapus bagian ini</button></fieldset>)}<button type="button" disabled={content.sections.length >= 30} onClick={() => set('sections', [...content.sections, editorSection({ title: '', paragraphs: [''] })])}>Tambah bagian</button>{[content.source, ...content.sources].map((source, index) => <fieldset key={source.id}><legend>Sumber {index + 1}</legend><label>Nama sumber<input required minLength={2} maxLength={200} value={source.name} onChange={e => { if (!index) set('source', { ...source, name: e.target.value }); else set('sources', content.sources.map((item, i) => i === index - 1 ? { ...item, name: e.target.value } : item)) }} /></label><label>URL HTTPS<input required type="url" pattern="https://.*" maxLength={2000} value={source.url} onChange={e => { if (!index) set('source', { ...source, url: e.target.value }); else set('sources', content.sources.map((item, i) => i === index - 1 ? { ...item, url: e.target.value } : item)) }} /></label>{index > 0 && <button type="button" onClick={() => set('sources', content.sources.filter((_, i) => i !== index - 1))}>Hapus sumber tambahan</button>}</fieldset>)}<button type="button" disabled={content.sources.length >= 20} onClick={() => set('sources', [...content.sources, editorSource({ name: '', url: '' })])}>Tambah sumber rujukan</button><p className="admin-footnote">Isi dirender sebagai teks terstruktur. HTML dan skrip tidak dijalankan. Menyimpan perubahan pada artikel terbit mengembalikannya menjadi draf.</p><button type="submit" className="admin-primary" disabled={mutation.busy}>Simpan draf</button></form>}<FeedbackMessage error={mutation.error} message={mutation.message} />{record && <div className="admin-publish"><h3>Publikasi</h3><p><DateTime value={record.updated_at} /></p><p>Terbitkan hanya setelah meninjau konten dan sumber. Artikel arsip/draf tidak tersedia melalui CMS publik.</p><div className="admin-actions">{['published', 'draft', 'archived'].filter(status => status !== record.status).map(status => <button type="button" key={status} disabled={mutation.busy} onClick={() => setConfirm(status)}>{({ published: 'Terbitkan', draft: 'Tarik ke draf', archived: 'Arsipkan' } as Record<string, string>)[status]}</button>)}</div></div>}{confirm && <Confirm title="Konfirmasi perubahan publikasi" busy={mutation.busy} onClose={() => setConfirm('')} onConfirm={() => void changeStatus()}><p>{content.title}</p><p>{confirm === 'save' ? 'Simpan konten dan tarik artikel dari publik sampai diterbitkan ulang.' : `Ubah status menjadi ${confirm}. Perubahan memengaruhi ketersediaan melalui CMS publik.`}</p></Confirm>}</section>
}
function ExistingEditor({ id, close, updated }: Readonly<{ id: string; close: () => void; updated: () => void }>) {
  const resource = useAdminData<ArticleRecord>(`articles/${id}`)
  const fallback = fallbackArticles.find(a => a.id === id || a.slug === id.replace('article-', ''))
  const data = resource.data ?? fallback
  return <><State error={resource.error} loading={!data} retry={resource.reload} />{data && <ArticleEditor key={`${data.id}:${data.version}`} record={data} close={close} updated={() => { close(); updated() }} />}</>
}
export function ArticlesPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const resource = useAdminData<Page<ArticleRecord>>(`articles?${new URLSearchParams({ search, status, offset: String(offset) })}`)
  const items = resource.data ? resource.data.items : fallbackArticles
  const total = resource.data ? resource.data.total : fallbackArticles.length
  return <><PageHead title="Pengetahuan yang bisa dipercaya." description="Kelola materi edukasi, sumber rujukan, dan status publikasinya."><button type="button" className="admin-primary" onClick={() => navigate('/admin/articles/new')}>Artikel baru</button></PageHead>{!cmsEnabled&&<p className="admin-notice">Sumber publik belum dialihkan ke CMS. Artikel asli tetap tampil sampai aktivasi data terverifikasi; perubahan CMS belum memengaruhi situs publik.</p>}<div className="admin-filters"><label>Cari judul<input maxLength={80} value={search} onChange={e => { setSearch(e.target.value.replace(/[^\p{L}\p{N}_ .-]/gu, '')); setOffset(0) }} /></label><label>Status artikel<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value="">Semua status</option><option value="draft">Draf</option><option value="published">Terbit</option><option value="archived">Diarsipkan</option></select></label></div><div className={selected !== undefined ? 'admin-split' : ''}><section><State error={resource.error} loading={resource.data === undefined && fallbackArticles.length === 0} empty={items.length === 0} retry={resource.reload} /><div className="admin-table-wrap"><table><caption className="sr-only">Artikel edukasi</caption><thead><tr><th>Artikel</th><th>Status</th><th>Diperbarui</th><th>Tindakan</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.title}</strong><p className="admin-mono">/education/{item.slug}</p></td><td><Status value={item.status} /></td><td><DateTime value={item.updated_at} /></td><td><button type="button" onClick={() => setSelected(item.id)}>Edit</button></td></tr>)}</tbody></table></div><Pager offset={offset} total={total} change={setOffset} /></section>{selected === null && <ArticleEditor record={null} close={() => setSelected(undefined)} updated={() => { setSelected(undefined); resource.reload() }} />}{typeof selected === 'string' && <ExistingEditor id={selected} close={() => setSelected(undefined)} updated={resource.reload} />}</div></>
}
