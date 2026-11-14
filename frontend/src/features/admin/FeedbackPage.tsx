import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAdminData, useAdminMutation, type Page, type Feedback, type FeedbackDetail } from './api'
import { PageHead, State, Status, Pager, DateTime, FeedbackMessage } from './ui'
import { feedbackCategories } from '../feedback/feedbackModel'

const statusNames = { new: 'Baru', in_review: 'Dalam tinjauan', resolved: 'Selesai' }
const categoryName = (value: string) => feedbackCategories.find(category => category.id === value)?.title ?? value

export function FeedbackReviewPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const resource = useAdminData<FeedbackDetail>('feedback/' + encodeURIComponent(id))
  const back = '/admin/feedback' + (params.size ? '?' + params : '')
  return <div className="admin-article-create-page">
    <PageHead title="Tinjau feedback" description="Baca masukan, perbarui status, atau balas pengirim.">
      <Link className="admin-back-link" to={back}>← Kembali ke feedback</Link>
    </PageHead>
    <State error={resource.error} loading={!resource.data} retry={resource.reload} />
    {resource.data && <section className="admin-editor admin-article-create-card" aria-label="Detail feedback">
      <ReviewForm key={id} record={resource.data} />
      {resource.data.can_reply
        ? <ReplyForm key={id} feedbackId={id} />
        : <p className="admin-footnote">Kotak pesan pengirim tidak tersedia untuk masukan ini.</p>}
    </section>}
  </div>
}

function ReplyForm({ feedbackId }: Readonly<{ feedbackId: string }>) {
  const [message, setMessage] = useState('')
  const [replyId, setReplyId] = useState(() => crypto.randomUUID())
  const mutation = useAdminMutation()

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) return
    if (await mutation.save(`feedback/${feedbackId}/replies`, 'POST', { id: replyId, message: message.trim() })) {
      setMessage('')
      setReplyId(crypto.randomUUID())
    }
  }

  return <form className="admin-publish" onSubmit={event => void submit(event)}>
    <label>Balasan untuk pengirim<textarea value={message} required maxLength={2000} disabled={mutation.busy}
      onChange={event => { setMessage(event.target.value); setReplyId(crypto.randomUUID()) }} /></label>
    <p className="admin-footnote">Balasan ini akan muncul di kotak pesan akun pengirim.</p>
    <FeedbackMessage error={mutation.error} message={mutation.message && 'Balasan terkirim ke akun pengirim.'} />
    <button className="admin-primary" type="submit" disabled={mutation.busy || !message.trim()}>Kirim balasan</button>
  </form>
}
function ReviewForm({ record }: Readonly<{ record: FeedbackDetail }>) {
  const [savedRecord, setSavedRecord] = useState(record)
  const [status, setStatus] = useState(record.status)
  const [note, setNote] = useState(record.note)
  const mutation = useAdminMutation()
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await mutation.save<{ version: number }>(`feedback/${record.id}`, 'PATCH', {
      version: savedRecord.version, status, note,
    })
    if (saved) setSavedRecord({ ...savedRecord, version: saved.version, status, note })
  }
  const { title, description, ...otherFields } = record.fields
  const fieldLabels: Record<string, string> = {
    feature: 'Fitur',
    errorType: 'Jenis kesalahan',
    reproduction: 'Langkah reproduksi',
    benefit: 'Manfaat',
  }
  return <>
    <section className="admin-feedback-content" aria-label="Isi masukan">
      <div className="admin-feedback-meta">
        <span>{categoryName(record.category)}</span>
        <Status value={savedRecord.status} />
        <DateTime value={record.created_at} />
      </div>
      <h2>{title || 'Isi masukan'}</h2>
      {description && <p className="admin-feedback-text">{description}</p>}
      <dl className="admin-detail admin-feedback-fields">
        {Object.entries(otherFields).filter(([, value]) => value).map(([field, value]) =>
          <div key={field}><dt>{fieldLabels[field] ?? field}</dt><dd>{value}</dd></div>
        )}
        {record.report_id && <div><dt>Referensi laporan</dt><dd className="admin-mono">{record.report_id}</dd></div>}
      </dl>
      {record.contact_email && <details>
        <summary>Kontak yang disertakan pengirim</summary>
        <p>{record.contact_email}</p>
        <p>Gunakan kontak ini untuk menindaklanjuti masukan.</p>
      </details>}
    </section>
    <form className="admin-feedback-handling" onSubmit={event => void submit(event)}>
      <h2>Penanganan feedback</h2>
      <label>Status penanganan<select value={status} onChange={event => setStatus(event.target.value)}>
        {Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Catatan internal<textarea value={note} maxLength={4000} onChange={event => setNote(event.target.value)} /></label>
      <p className="admin-footnote">Status selesai menandai bahwa masukan sudah ditangani.</p>
      <FeedbackMessage error={mutation.error} message={mutation.message} />
      <button type="submit" className="admin-primary" disabled={mutation.busy}>Simpan penanganan</button>
    </form>
  </>
}
export function AdminFeedbackPage() {
  const [params] = useSearchParams()
  return <FeedbackList key={params.toString()} params={params} />
}

function FeedbackList({ params }: Readonly<{ params: URLSearchParams }>) {
  const navigate = useNavigate()
  const [status, setStatus] = useState(Object.hasOwn(statusNames, params.get('status') ?? '') ? params.get('status')! : '')
  const [category, setCategory] = useState<string>(feedbackCategories.find(item => item.id === params.get('category'))?.id ?? '')
  const [since, setSince] = useState(/^\d{4}-\d{2}-\d{2}$/.test(params.get('since') ?? '') ? params.get('since')! : '')
  const [search, setSearch] = useState((params.get('search') ?? '').replace(/[^\p{L}\p{N}_ .-]/gu, '').slice(0, 80))
  const [offset, setOffset] = useState(/^\d{1,6}$/.test(params.get('offset') ?? '') ? Math.min(100000, Number(params.get('offset'))) : 0)
  const query = new URLSearchParams({ status, category, search, offset: String(offset), ...(since ? { since: `${since}T00:00:00Z` } : {}) })
  const resource = useAdminData<Page<Feedback>>(`feedback?${query}`)
  return <><PageHead title="Dengarkan. Tinjau. Tindak lanjuti." description="Masukan asli pengguna dan tamu, dengan penanganan yang dapat ditelusuri." /><div className="admin-filters"><label>Cari masukan<input value={search} maxLength={80} pattern="[\p{L}\p{N}_ .-]*" onChange={e => { setSearch(e.target.value.replace(/[^\p{L}\p{N}_ .-]/gu, '')); setOffset(0) }} /></label><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value="">Semua status</option><option value="new">Baru</option><option value="in_review">Ditinjau</option><option value="resolved">Selesai</option></select></label><label>Kategori<select value={category} onChange={e => { setCategory(e.target.value); setOffset(0) }}><option value="">Semua kategori</option>{['bug', 'detection', 'idea', 'other'].map(value => <option key={value} value={value}>{categoryName(value)}</option>)}</select></label><label>Sejak tanggal<input type="date" value={since} onChange={e => { setSince(e.target.value); setOffset(0) }} /></label></div><section><State error={resource.error} loading={!resource.data} empty={resource.data?.items.length === 0} retry={resource.reload} /><div className="admin-table-wrap"><table><caption className="sr-only">Daftar masukan</caption><thead><tr><th>Masukan</th><th>Status</th><th>Diterima</th><th>Tindakan</th></tr></thead><tbody>{resource.data?.items.map(item => <tr key={item.id}><td><small>{categoryName(item.category)}</small><p>{item.preview}</p></td><td><Status value={item.status} /></td><td><DateTime value={item.created_at} /></td><td><button type="button" onClick={() => navigate('/admin/feedback/' + encodeURIComponent(item.id) + '?' + new URLSearchParams({ status, category, since, search, offset: String(offset) }))}>Tinjau</button></td></tr>)}</tbody></table></div>{resource.data && <Pager offset={offset} total={resource.data.total} change={setOffset} />}</section></>
}
