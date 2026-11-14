import { useEffect, useState, type SubmitEvent } from 'react'
import { useAdminData, useAdminMutation, type Page } from './api'
import { DateTime, FeedbackMessage, PageHead, Pager, State } from './ui'
import type { ServiceAnnouncement } from '../announcements/useAnnouncements'

type AdminAnnouncement = ServiceAnnouncement & { enabled: boolean }

function localMinute(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function announcementStatus(item: AdminAnnouncement, expired: boolean, now: number) {
  if (!item.enabled) return 'Dinonaktifkan'
  if (expired) return 'Berakhir'
  return Date.parse(item.starts_at) > now ? 'Terjadwal' : 'Sedang tayang'
}

export function AnnouncementsPage() {
  const [offset, setOffset] = useState(0)
  const [formError, setFormError] = useState('')
  const [now, setNow] = useState(Date.now)
  const [startsAt, setStartsAt] = useState(() => localMinute(new Date()))
  const [endsAt, setEndsAt] = useState(() => localMinute(new Date(Date.now() + 60 * 60_000)))
  const resource = useAdminData<Page<AdminAnnouncement>>(`announcements?offset=${offset}`)
  const mutation = useAdminMutation()
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const messageField = fields.get('message')
    const startsField = fields.get('starts_at')
    const endsField = fields.get('ends_at')
    const message = typeof messageField === 'string' ? messageField.trim() : ''
    const starts = new Date(typeof startsField === 'string' ? startsField : '')
    const ends = new Date(typeof endsField === 'string' ? endsField : '')
    if (!message) {
      setFormError('Isi pesan pengumuman terlebih dahulu.')
      return
    }
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      setFormError('Waktu selesai harus lebih lambat dari waktu mulai. Contoh: mulai 16.15, selesai 17.15.')
      return
    }
    if (ends.getTime() <= Date.now()) {
      setFormError('Waktu selesai sudah lewat. Pilih waktu yang lebih baru.')
      return
    }
    setFormError('')
    if (await mutation.save('announcements', 'POST', { message, starts_at: starts.toISOString(), ends_at: ends.toISOString() })) {
      form.reset()
      setStartsAt(localMinute(new Date()))
      setEndsAt(localMinute(new Date(Date.now() + 60 * 60_000)))
      setOffset(0)
      resource.reload()
    }
  }

  async function disable(id: string) {
    setFormError('')
    if (await mutation.save(`announcements/${id}`, 'PATCH', undefined)) resource.reload()
  }

  return <>
    <PageHead title="Pengumuman Layanan" description="Jadwalkan pesan untuk kotak pesan dan teks berjalan di beranda." />
    <section className="admin-editor admin-announcement-form">
      <h2>Jadwalkan pengumuman</h2>
      <form onSubmit={event => void submit(event)}>
        <label>Pesan pengumuman<textarea name="message" required maxLength={240} rows={3} /></label>
        <div className="admin-article-grid-2">
          <label>Mulai tayang<input type="datetime-local" name="starts_at" required value={startsAt} onChange={event => {
            const next = event.target.value
            setStartsAt(next)
            setFormError('')
            if (next && (!endsAt || endsAt <= next)) setEndsAt(localMinute(new Date(Date.parse(next) + 60 * 60_000)))
          }} /></label>
          <label>Selesai tayang<input type="datetime-local" name="ends_at" required value={endsAt} onChange={event => {
            setEndsAt(event.target.value)
            setFormError('')
          }} /></label>
        </div>
        <p className="admin-footnote">Jadwal mengikuti zona waktu perangkatmu. Pengumuman dapat dibaca di beranda publik.</p>
        <button className="admin-primary" type="submit" disabled={mutation.busy}>Jadwalkan</button>
      </form>
      <FeedbackMessage error={formError || mutation.error} message={formError ? '' : mutation.message} />
    </section>
    <State error={resource.error} loading={!resource.data} empty={resource.data?.items.length === 0} retry={resource.reload} />
    {resource.data && resource.data.items.length > 0 && <div className="admin-table-wrap">
      <table><caption className="sr-only">Daftar pengumuman layanan</caption>
        <thead><tr><th>Pesan</th><th>Jadwal tayang</th><th>Status</th><th>Tindakan</th></tr></thead>
        <tbody>{resource.data.items.map(item => {
          const expired = Date.parse(item.ends_at) <= now
          const status = announcementStatus(item, expired, now)
          return <tr key={item.id}>
            <td>{item.message}</td><td><DateTime value={item.starts_at} /><br /><DateTime value={item.ends_at} /></td>
            <td>{status}</td><td>{item.enabled && !expired && <button type="button" disabled={mutation.busy} onClick={() => void disable(item.id)}>Hentikan tayang</button>}</td>
          </tr>
        })}</tbody>
      </table>
    </div>}
    {resource.data && resource.data.total > 20 && <Pager offset={offset} total={resource.data.total} change={setOffset} />}
  </>
}
