import { useEffect, useRef, type ReactNode } from 'react'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'

const statusLabels: Record<string, string> = { new: 'Baru', in_review: 'Ditinjau', resolved: 'Selesai', pending_review: 'Menunggu tinjauan', verified: 'Terverifikasi', rejected: 'Ditolak', archived: 'Diarsipkan', draft: 'Draf', published: 'Terbit' }
export function Status({ value }: Readonly<{ value: string }>) { return <span className={`admin-status admin-status-${value}`}>{statusLabels[value] ?? value}</span> }
export function DateTime({ value }: Readonly<{ value: string }>) { return <time dateTime={value}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))}</time> }
export function PageHead({ title, description, children }: Readonly<{ title: string; description: string; children?: ReactNode }>) { return <header className="admin-page-head"><div><p className="admin-eyebrow">AWASIN / PENGELOLAAN</p><h1>{title}</h1><p>{description}</p></div>{children}</header> }
export function State({ error, loading, empty, retry }: Readonly<{ error?: string; loading?: boolean; empty?: boolean; retry: () => void }>) {
  if (error) return <div className="admin-state"><p role="alert">{error}</p><button type="button" onClick={retry}>Muat ulang</button></div>
  if (loading) return <output className="admin-state">Memuat data pengelolaan…</output>
  if (empty) return <p className="admin-state">Belum ada data yang cocok. Ubah filter atau tambahkan data yang diperlukan.</p>
  return null
}
export function FeedbackMessage({ error, message }: Readonly<{ error: string; message: string }>) { return <>{error && <p className="admin-error" role="alert">{error}</p>}{message && <output className="admin-success">{message}</output>}</> }
export function Pager({ offset, total, change }: Readonly<{ offset: number; total: number; change: (n: number) => void }>) { return <nav className="admin-pager" aria-label="Halaman data"><span>{total ? `${offset + 1}–${Math.min(offset + 20, total)} dari ${total}` : '0 data'}</span><button type="button" aria-label="Halaman sebelumnya" disabled={!offset} onClick={() => change(Math.max(0, offset - 20))}><ArrowLeft size={16} /></button><button type="button" aria-label="Halaman berikutnya" disabled={offset + 20 >= total} onClick={() => change(offset + 20)}><ArrowRight size={16} /></button></nav> }
export function Confirm({ title, children, onClose, onConfirm, busy }: Readonly<{ title: string; children: ReactNode; onClose: () => void; onConfirm: () => void; busy: boolean }>) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog className="admin-confirm" ref={ref} aria-labelledby="admin-confirm-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}><h2 id="admin-confirm-title">{title}</h2><div>{children}</div><div className="admin-actions"><button type="button" disabled={busy} onClick={onClose}>Batal</button><button type="button" className="admin-primary" disabled={busy} onClick={onConfirm}>{busy ? 'Menyimpan…' : 'Ya, lanjutkan'}</button></div></dialog>
}
export function EditorHead({ title, close }: Readonly<{ title: string; close: () => void }>) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    heading.current?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({preventScroll:true}) }
  }, [])
  return <header className="admin-editor-head"><h2 ref={heading} tabIndex={-1}>{title}</h2><button type="button" onClick={close} aria-label="Tutup editor"><X size={18} /></button></header>
}
