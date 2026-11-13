import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useAdminMutation } from './api'
import { FeedbackMessage } from './ui'
import {
  emptyArticle,
  editorContent,
  articleContent,
  editorSection,
  editorSource,
  editorParagraph,
  generateSlug,
  type EditorContent,
} from './articleTypes'

export function ArticleCreatePage() {
  const navigate = useNavigate()
  const [content, setContent] = useState<EditorContent>(() => editorContent(emptyArticle))
  const [preview, setPreview] = useState(false)
  const mutation = useAdminMutation()

  const set = <K extends keyof EditorContent>(key: K, value: EditorContent[K]) =>
    setContent(old => ({ ...old, [key]: value }))

  const computedSlug = content.slug.trim()
    ? generateSlug(content.slug)
    : (content.title.trim() ? generateSlug(content.title) : 'otomatis-dari-judul')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const finalSlug = content.slug.trim()
      ? generateSlug(content.slug)
      : generateSlug(content.title)

    const payload = {
      content: {
        ...articleContent(content),
        slug: finalSlug,
      },
    }

    const result = await mutation.save('articles', 'POST', payload)
    if (result) {
      setTimeout(() => {
        navigate('/admin/articles')
      }, 1200)
    }
  }

  return (
    <div className="admin-article-create-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-eyebrow">AWASIN / PENGELOLAAN / ARTIKEL</p>
          <h1>Artikel Baru</h1>
          <p>Susun materi edukasi baru, kelola struktur bagian, dan cantumkan sumber rujukan tepercaya.</p>
        </div>
        <Link to="/admin/articles" className="admin-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Kembali ke daftar artikel</span>
        </Link>
      </header>

      <section className="admin-editor admin-article-create-card">
        <div className="admin-actions">
          <button
            type="button"
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
          >
            Tulis
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview(true)}
          >
            Pratinjau
          </button>
        </div>

        {preview ? (
          <article className="admin-preview">
            <p className="admin-preview-category">{content.category || 'Kategori belum diisi'}</p>
            <h2>{content.title || 'Judul artikel belum diisi'}</h2>
            <p className="admin-preview-desc">{content.description || 'Ringkasan artikel belum diisi'}</p>
            {content.sections.map(section => (
              <section key={section.id}>
                <h3>{section.title || 'Bagian tanpa judul'}</h3>
                {section.paragraphs.map(paragraph => (
                  <p key={paragraph.id}>{paragraph.text}</p>
                ))}
              </section>
            ))}
            <h3>Sumber rujukan</h3>
            {[content.source, ...content.sources]
              .filter(s => s.name || s.url)
              .map(source => (
                <p key={source.id}>
                  {source.name} · {source.url}
                </p>
              ))}
            <p className="admin-footnote">
              Pratinjau internal. Artikel baru akan disimpan sebagai draf dan belum tersedia untuk publik.
            </p>
          </article>
        ) : (
          <form onSubmit={e => void submit(e)}>
            <div className="admin-form-group">
              <label>
                Judul artikel
                <input
                  required
                  minLength={5}
                  maxLength={200}
                  placeholder="Contoh: Kenali Ciri Modus Phishing Terkini"
                  value={content.title}
                  onChange={e => set('title', e.target.value)}
                />
              </label>
            </div>

            <div className="admin-form-group">
              <label>
                Slug URL (opsional)
                <input
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  minLength={2}
                  maxLength={100}
                  placeholder="Dibuat otomatis dari judul jika dikosongkan"
                  value={content.slug}
                  onChange={e => set('slug', e.target.value)}
                />
              </label>
              <p className="admin-footnote" style={{ margin: '4px 0 0' }}>
                Slug URL bersifat opsional. Pratinjau tautan publik:{' '}
                <span className="admin-mono">/education/{computedSlug}</span>
              </p>
            </div>

            <div className="admin-form-group">
              <label>
                Ringkasan
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  placeholder="Tuliskan ringkasan singkat artikel untuk ditampilkan pada kartu edukasi..."
                  value={content.description}
                  onChange={e => set('description', e.target.value)}
                />
              </label>
            </div>

            <div className="admin-article-grid-2">
              <label>
                Kategori
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Misal: Phishing, Rekening Palsu"
                  value={content.category}
                  onChange={e => set('category', e.target.value)}
                />
              </label>
              <label>
                Gambar editorial
                <select
                  value={content.image}
                  onChange={e => set('image', e.target.value)}
                >
                  {['phishing', 'message', 'qr', 'media'].map(name => (
                    <option key={name} value={`/assets/education/${name}.jpg`}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-section-divider-wrap">
              <div className="admin-section-head">
                <h3>Bagian Artikel</h3>
                <span className="admin-mono">{content.sections.length} bagian</span>
              </div>
            </div>

            {content.sections.map((section, index) => (
              <fieldset key={section.id}>
                <legend>Bagian {index + 1}</legend>
                <label>
                  Judul bagian
                  <input
                    required
                    minLength={2}
                    maxLength={200}
                    placeholder="Contoh: Modus yang Sering Digunakan"
                    value={section.title}
                    onChange={e =>
                      set(
                        'sections',
                        content.sections.map((value, i) =>
                          i === index ? { ...value, title: e.target.value } : value
                        )
                      )
                    }
                  />
                </label>
                <label>
                  Paragraf (pisahkan antar-paragraf dengan dua kali enter)
                  <textarea
                    required
                    maxLength={100000}
                    placeholder="Tulis paragraf penjelasan di sini..."
                    value={section.paragraphs.map(paragraph => paragraph.text).join('\n\n')}
                    onChange={e =>
                      set(
                        'sections',
                        content.sections.map((value, i) =>
                          i === index
                            ? {
                                ...value,
                                paragraphs: e.target.value.split('\n\n').map(editorParagraph),
                              }
                            : value
                        )
                      )
                    }
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={content.sections.length <= 1}
                    onClick={() =>
                      set(
                        'sections',
                        content.sections.filter((_, i) => i !== index)
                      )
                    }
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    <span>Hapus bagian ini</span>
                  </button>
                </div>
              </fieldset>
            ))}

            <button
              type="button"
              disabled={content.sections.length >= 30}
              onClick={() =>
                set('sections', [
                  ...content.sections,
                  editorSection({ title: '', paragraphs: [''] }),
                ])
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifySelf: 'start' }}
            >
              <Plus size={16} aria-hidden="true" />
              <span>Tambah bagian</span>
            </button>

            <div className="admin-section-divider-wrap" style={{ marginTop: '16px' }}>
              <div className="admin-section-head">
                <h3>Sumber Rujukan</h3>
                <span className="admin-mono">{1 + content.sources.length} sumber</span>
              </div>
            </div>

            {[content.source, ...content.sources].map((source, index) => (
              <fieldset key={source.id}>
                <legend>Sumber {index + 1}{index === 0 ? ' (Utama)' : ''}</legend>
                <div className="admin-article-grid-2">
                  <label>
                    Nama sumber
                    <input
                      required
                      minLength={2}
                      maxLength={200}
                      placeholder="Contoh: BSSN / Kominfo"
                      value={source.name}
                      onChange={e => {
                        if (!index) set('source', { ...source, name: e.target.value })
                        else
                          set(
                            'sources',
                            content.sources.map((item, i) =>
                              i === index - 1 ? { ...item, name: e.target.value } : item
                            )
                          )
                      }}
                    />
                  </label>
                  <label>
                    URL HTTPS
                    <input
                      required
                      type="url"
                      pattern="https://.*"
                      maxLength={2000}
                      placeholder="https://..."
                      value={source.url}
                      onChange={e => {
                        if (!index) set('source', { ...source, url: e.target.value })
                        else
                          set(
                            'sources',
                            content.sources.map((item, i) =>
                              i === index - 1 ? { ...item, url: e.target.value } : item
                            )
                          )
                      }}
                    />
                  </label>
                </div>
                {index > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'sources',
                          content.sources.filter((_, i) => i !== index - 1)
                        )
                      }
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Hapus sumber tambahan</span>
                    </button>
                  </div>
                )}
              </fieldset>
            ))}

            <button
              type="button"
              disabled={content.sources.length >= 20}
              onClick={() =>
                set('sources', [...content.sources, editorSource({ name: '', url: '' })])
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifySelf: 'start' }}
            >
              <Plus size={16} aria-hidden="true" />
              <span>Tambah sumber rujukan</span>
            </button>

            <p className="admin-footnote">
              Isi dirender sebagai teks terstruktur. HTML dan skrip tidak dijalankan. Menyimpan draf artikel baru tidak langsung menerbitkan ke publik sampai statusnya diubah menjadi terbit.
            </p>

            <FeedbackMessage error={mutation.error} message={mutation.message} />

            <div className="admin-actions" style={{ marginTop: '20px' }}>
              <button type="submit" className="admin-primary" disabled={mutation.busy}>
                {mutation.busy ? 'Menyimpan…' : 'Simpan draf'}
              </button>
              <button
                type="button"
                disabled={mutation.busy}
                onClick={() => navigate('/admin/articles')}
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

