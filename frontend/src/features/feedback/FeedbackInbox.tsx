import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Megaphone, MessageSquare, X } from 'lucide-react'
import { accountRequest } from '../settings/api'
import { feedbackCategories, type FeedbackCategory } from './feedbackModel'
import { useAnnouncements } from '../announcements/useAnnouncements'
import './feedback-inbox.css'

type Reply = {
  id: string
  category: FeedbackCategory
  feedback_title: string
  feedback_created_at: string
  message: string
  created_at: string
}
type Inbox = { items: Reply[]; has_more: boolean }
const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
const firstPagePath = '/feedback/replies?offset=0'

function readSeen(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}

export function FeedbackInbox({ owner, onOpen }: Readonly<{ owner: string; onOpen: () => void }>) {
  const announcements = useAnnouncements()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState<Inbox>()
  const [error, setError] = useState('')
  const seenKey = `awasin:feedback-seen:${owner}`
  const [seenId, setSeenId] = useState(() => readSeen(seenKey))
  const [latestId, setLatestId] = useState<string | null>(null)
  const announcementKey = `awasin:announcement-seen:${owner}`
  const [seenAnnouncements, setSeenAnnouncements] = useState(() => readSeen(announcementKey))
  const activeIds = announcements.map(item => item.id).sort((left, right) => left.localeCompare(right)).join(',')
  const hasUnreadAnnouncement = !open && announcements.some(item => !seenAnnouncements?.split(',').includes(item.id))
  const hasUnreadReply = !open && latestId !== null && latestId !== seenId
  let triggerLabel = 'Pesan feedback'
  if (hasUnreadAnnouncement) triggerLabel = 'Pesan AWASIN, ada pengumuman baru'
  else if (hasUnreadReply) triggerLabel = 'Pesan feedback, ada balasan baru'

  useEffect(() => {
    if (open && activeIds) {
      try { localStorage.setItem(announcementKey, activeIds) } catch { /* Storage may be disabled. */ }
    }
  }, [open, activeIds, announcementKey])

  useEffect(() => {
    if (open) return
    const controller = new AbortController()
    let checking = false
    async function checkForReplies() {
      if (checking || document.hidden) return
      checking = true
      try {
        const inbox = await accountRequest(firstPagePath, 'GET', undefined, controller.signal, owner) as Inbox
        if (!controller.signal.aborted) setLatestId(inbox.items[0]?.id ?? null)
      } catch {
        // Keep the last known badge while offline. The inbox displays errors when opened.
      } finally {
        checking = false
      }
    }
    void checkForReplies()
    const interval = window.setInterval(checkForReplies, 30_000)
    window.addEventListener('focus', checkForReplies)
    document.addEventListener('visibilitychange', checkForReplies)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', checkForReplies)
      document.removeEventListener('visibilitychange', checkForReplies)
    }
  }, [open, owner])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void accountRequest(`/feedback/replies?offset=${offset}`, 'GET', undefined, controller.signal, owner)
      .then(data => {
        if (controller.signal.aborted) return
        const inbox = data as Inbox
        setPage(inbox)
        if (offset === 0) {
          const id = inbox.items[0]?.id ?? null
          setLatestId(id)
          setSeenId(id)
          try {
            if (id) localStorage.setItem(seenKey, id)
            else localStorage.removeItem(seenKey)
          } catch {
            // The read state remains available for this session.
          }
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError('Balasan belum bisa dimuat. Coba lagi.') })
    return () => controller.abort()
  }, [open, owner, offset, revision, seenKey])

  function show() {
    onOpen()
    setPage(undefined)
    setError('')
    setOffset(0)
    const element = dialog.current
    const bounds = trigger.current?.getBoundingClientRect()
    if (!element || !bounds || element.open) return
    element.style.setProperty('--inbox-top', `${Math.ceil(bounds.bottom + 12)}px`)
    element.style.setProperty('--inbox-right', `${Math.max(16, Math.round(window.innerWidth - bounds.right))}px`)
    element.showModal()
    setOpen(true)
  }

  function changePage(next: number) {
    setPage(undefined)
    setError('')
    setOffset(next)
  }

  return <>
    <button ref={trigger} type="button" className="nav-login nav-glass feedback-inbox-trigger"
      aria-label={triggerLabel}
      title="Balasan dan pengumuman AWASIN" aria-haspopup="dialog" aria-expanded={open} onClick={show}>
      <MessageSquare size={20} aria-hidden="true" />
      {(hasUnreadAnnouncement || hasUnreadReply) && <span className="feedback-inbox-unread" aria-hidden="true" />}
    </button>
    {typeof document !== 'undefined' && createPortal(<dialog ref={dialog} className="feedback-inbox" aria-labelledby="feedback-inbox-title" onClose={() => {
      if (!dialog.current?.open) {
        setOpen(false)
        if (activeIds) setSeenAnnouncements(activeIds)
        trigger.current?.focus()
      }
    }}>
      <header>
        <h2 id="feedback-inbox-title" tabIndex={-1} autoFocus><MessageSquare size={18} aria-hidden="true" /> Pesan AWASIN</h2>
        <button type="button" aria-label="Tutup pesan" onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="feedback-inbox-body" aria-live="polite">
        {announcements.length > 0 && <section aria-labelledby="inbox-announcements-title">
          <h3 id="inbox-announcements-title" className="feedback-inbox-section-title"><Megaphone size={16} aria-hidden="true" /> Pengumuman layanan</h3>
          <ul className="feedback-inbox-announcements">
          {announcements.map(item => <li key={item.id}>
            <p className="feedback-inbox-message">{item.message}</p>
            <p className="feedback-inbox-expiry">Tayang sampai <time dateTime={item.ends_at}>{date.format(new Date(item.ends_at))}</time></p>
          </li>)}
          </ul>
        </section>}
        <section aria-labelledby="inbox-replies-title">
        <h3 id="inbox-replies-title" className="feedback-inbox-section-title">Balasan feedback</h3>
        {error && <><p>{error}</p><button className="button button-glass" type="button" onClick={() => {
          setError('')
          setRevision(value => value + 1)
        }}>Coba lagi</button></>}
        {!error && !page && <p>Memuat balasan…</p>}
        {!error && page?.items.length === 0 && <p>Belum ada balasan untuk feedback kamu.</p>}
        {!error && page && page.items.length > 0 && <ul>
            {page.items.map(reply => <li key={reply.id}>
              <div className="feedback-inbox-meta">
                <span>{feedbackCategories.find(category => category.id === reply.category)?.title}</span>
                <time dateTime={reply.created_at}>{date.format(new Date(reply.created_at))}</time>
              </div>
              <h4>{reply.feedback_title}</h4>
              <p className="feedback-inbox-author">Tim AWASIN</p>
              <p className="feedback-inbox-message">{reply.message}</p>
            </li>)}
          </ul>}
        {(offset > 0 || page?.has_more) && <nav aria-label="Halaman pesan">
          <button className="button button-glass" type="button" disabled={!page || offset === 0} onClick={() => changePage(offset - 20)}>Sebelumnya</button>
          <button className="button button-glass" type="button" disabled={!page?.has_more} onClick={() => changePage(offset + 20)}>Berikutnya</button>
        </nav>}
        </section>
      </div>
    </dialog>, document.body)}
  </>
}
