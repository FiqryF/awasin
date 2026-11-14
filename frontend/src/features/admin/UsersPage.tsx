import { useState } from 'react'
import { useAdminData, type Page } from './api'
import { DateTime, PageHead, Pager, State } from './ui'

type RegisteredUser = {
  id: string
  display_name: string | null
  email: string | null
  role: 'admin' | 'user' | null
  created_at: string
}

export function UsersPage() {
  const [offset, setOffset] = useState(0)
  const resource = useAdminData<Page<RegisteredUser>>(`users?offset=${offset}`)
  return <>
    <PageHead title="Pengguna Terdaftar" description="Lihat akun AWASIN, peran, dan waktu pendaftarannya." />
    <State error={resource.error} loading={!resource.data} empty={resource.data?.total === 0} retry={resource.reload} />
    {resource.data && resource.data.items.length > 0 && <>
      <div className="admin-table-wrap"><table>
        <caption className="sr-only">Akun pengguna terdaftar</caption>
        <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Terdaftar</th></tr></thead>
        <tbody>{resource.data.items.map(user => <tr key={user.id}>
          <td><strong>{user.display_name || 'Belum diisi'}</strong></td>
          <td>{user.email ?? '—'}</td>
          <td>{user.role === 'admin' ? 'Administrator' : user.role === 'user' ? 'Pengguna' : '—'}</td>
          <td><DateTime value={user.created_at} /></td>
        </tr>)}</tbody>
      </table></div>
      {resource.data.total > 20 && <Pager offset={offset} total={resource.data.total} change={setOffset} />}
    </>}
  </>
}
