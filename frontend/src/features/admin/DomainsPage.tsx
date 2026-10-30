import { useState, type SubmitEvent } from 'react'
import { useAdminData, useAdminMutation, type Page, type Organization, type Domain } from './api'
import { PageHead, State, Status, Pager, DateTime, FeedbackMessage, EditorHead, Confirm } from './ui'

function Organizations() {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Organization | null>(null)
  const data = useAdminData<Page<Organization>>(`organizations?${new URLSearchParams({ search, offset: String(offset) })}`)
  return <details className="admin-organizations"><summary>Direktori organisasi · tambah atau perbarui</summary><label>Cari nama organisasi<input value={search} maxLength={80} onChange={e => { setSearch(e.target.value.replace(/[^\p{L}\p{N}_ .-]/gu, '')); setOffset(0) }} /></label><State error={data.error} loading={!data.data} empty={data.data?.items.length === 0} retry={data.reload} />{data.data?.items.map(item => <div className="admin-event" key={item.id}><span>{item.name} · {item.category}</span><button type="button" onClick={() => setSelected(item)}>Edit</button></div>)}{data.data && <Pager offset={offset} total={data.data.total} change={setOffset} />}<OrganizationForm key={selected?.id ?? 'new'} record={selected} saved={() => { setSelected(null); data.reload() }} /><button type="button" onClick={() => setSelected(null)}>Organisasi baru</button></details>
}
function OrganizationForm({ record, saved }: Readonly<{ record: Organization | null; saved: () => void }>) {
  const [name, setName] = useState(record?.name ?? '')
  const [category, setCategory] = useState(record?.category ?? '')
  const [description, setDescription] = useState(record?.description ?? '')
  const mutation = useAdminMutation()
  async function submit(e: SubmitEvent<HTMLFormElement>) { e.preventDefault(); if (await mutation.save(record ? `organizations/${record.id}` : 'organizations', record ? 'PATCH' : 'POST', { name, category, description, ...(record ? { version: record.version } : {}) })) { setName(''); setCategory(''); setDescription(''); saved() } }
  return <form className="admin-form" onSubmit={e => void submit(e)}><h3>{record ? 'Perbarui organisasi' : 'Organisasi baru'}</h3><label>Nama organisasi<input required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} /></label><label>Kategori organisasi<input required minLength={2} maxLength={80} value={category} onChange={e => setCategory(e.target.value)} /></label><label>Deskripsi<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label><FeedbackMessage error={mutation.error} message={mutation.message} /><button type="submit" className="admin-primary" disabled={mutation.busy}>Simpan organisasi</button></form>
}
function DomainForm({ record, close, saved }: Readonly<{ record: Domain | null; close: () => void; saved: () => void }>) {
  const [organizationSearch, setOrganizationSearch] = useState('')
  const organizations = useAdminData<Page<Organization>>(`organizations?limit=50&search=${encodeURIComponent(organizationSearch)}`)
  const [organization, setOrganization] = useState(record?.organization_id ?? '')
  const [domain, setDomain] = useState(record?.domain ?? '')
  const [url, setUrl] = useState(record?.evidence_url ?? '')
  const [description, setDescription] = useState(record?.evidence_description ?? '')
  const [note, setNote] = useState('')
  const [decision, setDecision] = useState('')
  const mutation = useAdminMutation()
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (await mutation.save(record ? `domains/${record.id}` : 'domains', record ? 'PATCH' : 'POST', { organization_id: organization, domain, evidence_url: url, evidence_description: description, ...(record ? { version: record.version } : {}) })) saved()
  }
  async function review() {
    if (!record) return
    if (await mutation.save(`domains/${record.id}/review`, 'POST', { status: decision, review_note: note, version: record.version })) {
      setDecision('')
      saved()
    }
  }
  return <section className="admin-editor"><EditorHead title={record ? 'Tinjauan domain' : 'Kandidat domain baru'} close={close} />{record && <><p><Status value={record.status} /></p><p className="admin-mono">{record.domain}</p>{record.verified_at && <p>Tinjauan disetujui: <DateTime value={record.verified_at} /></p>}{record.reviewed_by && <p className="admin-mono">Peninjau: {record.reviewed_by}</p>}{record.review_note && <p>{record.review_note}</p>}<a href={record.evidence_url} target="_blank" rel="noopener noreferrer">Buka sumber bukti (tab baru)</a></>}<form onSubmit={e => void submit(e)}><label>Cari organisasi<input maxLength={80} value={organizationSearch} onChange={e => setOrganizationSearch(e.target.value.replace(/[^\p{L}\p{N}_ .-]/gu, ''))} /></label><State error={organizations.error} retry={organizations.reload} /><label>Organisasi<select required value={organization} onChange={e => setOrganization(e.target.value)}><option value="">Pilih organisasi</option>{record && !organizations.data?.items.some(o => o.id === record.organization_id) && <option value={record.organization_id}>{record.organization_id}</option>}{organizations.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="admin-footnote">Maksimal 50 hasil pencarian organisasi. Tambahkan organisasi melalui direktori bila belum ada.</p><label>Hostname domain<input required value={domain} maxLength={253} placeholder="contoh.org" onChange={e => setDomain(e.target.value)} /></label><p className="admin-footnote">Tanpa https:// atau path. IDN disimpan dalam Punycode; karakter mirip tidak disamakan. Tidak ada pengumpulan domain otomatis.</p><label>URL bukti resmi<input required type="url" pattern="https://.*" maxLength={2000} value={url} onChange={e => setUrl(e.target.value)} /></label><label>Penjelasan hubungan resmi<textarea required minLength={20} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} /></label><p className="admin-footnote">Mengubah domain atau bukti membatalkan verifikasi sebelumnya dan mengembalikan status menunggu tinjauan.</p><FeedbackMessage error={mutation.error} message={mutation.message} /><button type="submit" className="admin-primary" disabled={mutation.busy}>{record ? 'Simpan dan tinjau ulang' : 'Simpan kandidat'}</button></form>{record && <form onSubmit={e => { e.preventDefault(); setDecision((e.nativeEvent as globalThis.SubmitEvent).submitter?.getAttribute('value') ?? '') }}><h3>Keputusan peninjau</h3><label>Alasan keputusan<textarea required minLength={10} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label><div className="admin-actions">{record.status === 'pending_review' && <><button type="submit" value="verified" disabled={mutation.busy}>Verifikasi hubungan</button><button type="submit" value="rejected" disabled={mutation.busy}>Tolak kandidat</button></>}<button type="submit" value="archived" disabled={mutation.busy || record.status === 'archived'}>Arsipkan</button></div></form>}{decision && <Confirm title="Konfirmasi keputusan domain" busy={mutation.busy} onClose={() => setDecision('')} onConfirm={() => void review()}><p>{record?.domain} → {decision}</p><p>{note}</p><p>Verifikasi menyatakan hubungan organisasi yang didukung bukti, bukan jaminan keamanan website atau seluruh URL-nya.</p></Confirm>}</section>
}
export function DomainsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Domain | null | undefined>(undefined)
  const resource = useAdminData<Page<Domain>>(`domains?${new URLSearchParams({ search, status, offset: String(offset) })}`)
  return <><PageHead title="Referensi, dengan bukti." description="Registry hubungan domain dan organisasi melalui input serta tinjauan manual."><button type="button" className="admin-primary" onClick={() => setSelected(null)}>Tambah kandidat</button></PageHead><p className="admin-notice">Domain terverifikasi bukan jaminan keamanan situs. Bukti HTTPS atau sertifikat saja tidak cukup untuk membuktikan hubungan organisasi.</p><Organizations /><div className="admin-filters"><label>Cari domain<input value={search} maxLength={80} onChange={e => { setSearch(e.target.value.replace(/[^a-zA-Z0-9 .-]/g, '')); setOffset(0) }} /></label><label>Status domain<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value="">Semua status</option>{['pending_review', 'verified', 'rejected', 'archived'].map(value => <option key={value}>{value}</option>)}</select></label></div><div className={selected !== undefined ? 'admin-split' : ''}><section><State error={resource.error} loading={!resource.data} empty={resource.data?.items.length === 0} retry={resource.reload} /><div className="admin-table-wrap"><table><caption className="sr-only">Registry domain</caption><thead><tr><th>Domain</th><th>Status</th><th>Ditambahkan</th><th>Tindakan</th></tr></thead><tbody>{resource.data?.items.map(row => <tr key={row.id}><td className="admin-mono">{row.domain}</td><td><Status value={row.status} /></td><td><DateTime value={row.created_at} /></td><td><button type="button" onClick={() => setSelected(row)}>Buka</button></td></tr>)}</tbody></table></div>{resource.data && <Pager offset={offset} total={resource.data.total} change={setOffset} />}</section>{selected !== undefined && <DomainForm key={selected ? `${selected.id}:${selected.version}` : 'new'} record={selected} close={() => setSelected(undefined)} saved={() => { setSelected(undefined); resource.reload() }} />}</div></>
}
