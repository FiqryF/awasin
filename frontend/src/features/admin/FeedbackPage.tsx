import { useState, type SubmitEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useAdminData, useAdminMutation, type Page, type Feedback, type FeedbackDetail } from './api'
import { PageHead, State, Status, Pager, DateTime, FeedbackMessage, EditorHead } from './ui'

function Review({ id, close, updated }: Readonly<{ id: string; close: () => void; updated: () => void }>) {
  const resource = useAdminData<FeedbackDetail>(`feedback/${id}`)
  return <section className="admin-editor" aria-label="Tinjau feedback"><EditorHead title="Tinjau feedback" close={close} /><State error={resource.error} loading={!resource.data} retry={resource.reload} />{resource.data && <ReviewForm key={`${id}:${resource.data.version}`} record={resource.data} updated={() => { resource.reload(); updated() }} />}</section>
}
function ReviewForm({ record, updated }: Readonly<{ record: FeedbackDetail; updated: () => void }>) {
  const [status, setStatus] = useState(record.status)
  const [note, setNote] = useState(record.note)
  const mutation = useAdminMutation()
  async function submit(event: SubmitEvent<HTMLFormElement>) { event.preventDefault(); if (await mutation.save(`feedback/${record.id}`, 'PATCH', { version: record.version, status, note })) updated() }
  return <><p><Status value={record.status} /> · {record.category}</p><DateTime value={record.created_at} /><dl className="admin-detail">{Object.entries(record.fields).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{({ title: 'Judul', description: 'Penjelasan', feature: 'Fitur', errorType: 'Jenis kesalahan', reproduction: 'Langkah reproduksi', benefit: 'Manfaat' } as Record<string, string>)[label] ?? label}</dt><dd>{value}</dd></div>)}</dl>{record.report_id && <p className="admin-mono">Referensi laporan: {record.report_id}</p>}{record.contact_email && <details><summary>Kontak yang disertakan pengirim</summary><p>{record.contact_email}</p><p>Gunakan hanya untuk penanganan masukan ini. Tidak ada balasan otomatis.</p></details>}<form onSubmit={event => void submit(event)}><label>Status penanganan<select value={status} onChange={e => setStatus(e.target.value)}>{['new', 'in_review', 'resolved'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Catatan internal<textarea value={note} maxLength={4000} onChange={e => setNote(e.target.value)} /></label><p className="admin-footnote">Isi asli tidak diubah. Status selesai bukan konfirmasi kesalahan hasil analisis.</p><FeedbackMessage error={mutation.error} message={mutation.message} /><button type="submit" className="admin-primary" disabled={mutation.busy}>Simpan penanganan</button></form></>
}
export function AdminFeedbackPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') === 'new' ? 'new' : '')
  const [category, setCategory] = useState('')
  const [since, setSince] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const query = new URLSearchParams({ status, category, search, offset: String(offset), ...(since ? { since: `${since}T00:00:00Z` } : {}) })
  const resource = useAdminData<Page<Feedback>>(`feedback?${query}`)
  return <><PageHead title="Dengarkan. Tinjau. Tindak lanjuti." description="Masukan asli pengguna dan tamu, dengan penanganan yang dapat ditelusuri." /><div className="admin-filters"><label>Cari masukan<input value={search} maxLength={80} pattern="[\p{L}\p{N}_ .-]*" onChange={e => { setSearch(e.target.value.replace(/[^\p{L}\p{N}_ .-]/gu, '')); setOffset(0) }} /></label><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value="">Semua status</option><option value="new">Baru</option><option value="in_review">Ditinjau</option><option value="resolved">Selesai</option></select></label><label>Kategori<select value={category} onChange={e => { setCategory(e.target.value); setOffset(0) }}><option value="">Semua kategori</option>{['bug', 'detection', 'idea', 'other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Sejak tanggal<input type="date" value={since} onChange={e => { setSince(e.target.value); setOffset(0) }} /></label></div><div className={selected ? 'admin-split' : ''}><section><State error={resource.error} loading={!resource.data} empty={resource.data?.items.length === 0} retry={resource.reload} /><div className="admin-table-wrap"><table><caption className="sr-only">Daftar masukan</caption><thead><tr><th>Masukan</th><th>Status</th><th>Diterima</th><th>Tindakan</th></tr></thead><tbody>{resource.data?.items.map(item => <tr key={item.id}><td><small>{item.category}</small><p>{item.preview}</p></td><td><Status value={item.status} /></td><td><DateTime value={item.created_at} /></td><td><button type="button" onClick={() => setSelected(item.id)}>Tinjau</button></td></tr>)}</tbody></table></div>{resource.data && <Pager offset={offset} total={resource.data.total} change={setOffset} />}</section>{selected && <Review key={selected} id={selected} close={() => setSelected(null)} updated={resource.reload} />}</div></>
}
