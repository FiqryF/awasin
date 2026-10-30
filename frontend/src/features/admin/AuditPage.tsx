import { useState } from 'react'
import { useAdminData, auditLabel, type Page, type Audit } from './api'
import { PageHead, State, Pager, DateTime } from './ui'

export function AuditPage() {
  const [entity, setEntity] = useState('')
  const [since, setSince] = useState('')
  const [offset, setOffset] = useState(0)
  const query = new URLSearchParams({ entity_type: entity, offset: String(offset) })
  if (since) query.set('since', `${since}T00:00:00Z`)
  const resource = useAdminData<Page<Audit>>(`audit?${query}`)
  return <><PageHead title="Setiap perubahan, tercatat." description="Jejak baca saja untuk tindakan pengelolaan. Identitas pelaku berasal dari sesi database." /><div className="admin-filters"><label>Jenis data<select value={entity} onChange={e => { setEntity(e.target.value); setOffset(0) }}><option value="">Semua jenis</option>{['feedback_handling', 'registry_domains', 'registry_organizations', 'education_articles'].map(value => <option key={value}>{value}</option>)}</select></label><label>Sejak tanggal<input type="date" value={since} onChange={e => { setSince(e.target.value); setOffset(0) }} /></label></div><State error={resource.error} loading={!resource.data} empty={resource.data?.items.length === 0} retry={resource.reload} /><div className="admin-table-wrap"><table><caption className="sr-only">Audit administrasi</caption><thead><tr><th>Waktu</th><th>Perubahan</th><th>Pelaku</th><th>Objek / metadata</th></tr></thead><tbody>{resource.data?.items.map(event => <tr key={event.id}><td><DateTime value={event.created_at} /></td><td>{auditLabel(event.action)}</td><td className="admin-mono">{event.actor_id ?? 'Sistem / identitas tidak tersedia'}</td><td><span className="admin-mono">{event.entity_id}</span><p>{JSON.stringify(event.metadata)}</p></td></tr>)}</tbody></table></div>{resource.data && <Pager offset={offset} total={resource.data.total} change={setOffset} />}<p className="admin-footnote">Audit tidak menyimpan isi Feedback, catatan pribadi, token, atau isi lengkap artikel. Tidak tersedia tindakan edit atau hapus.</p></>
}
