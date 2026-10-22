import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { feedbackCategories, feedbackFields } from './feedbackModel'
import type { FeedbackCategory, FeedbackDraft } from './feedbackModel'

export function FeedbackReview({ category, draft, onEdit }: Readonly<{ category: FeedbackCategory; draft: FeedbackDraft; onEdit: () => void }>) {
  const entries = [
    { label: 'Topik', value: feedbackCategories.find(({ id }) => id === category)!.title },
    ...feedbackFields[category].map(({ name, label }) => ({ label, value: draft[name].trim() })),
    { label: 'Email untuk tindak lanjut', value: draft.email.trim() },
    { label: 'Lampiran', value: draft.file?.name ?? '' },
  ].filter(({ value }) => value)
  return <>
    <dl className="feedback-summary">{entries.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="feedback-sensitive">Jangan sertakan password, OTP, atau informasi sensitif di dalam laporan.</p>
    <div className="feedback-availability" id="feedback-unavailable"><LockKeyhole size={18} aria-hidden="true" /><p><strong>Pengiriman belum tersedia.</strong> Masukan ini masih berupa draf di perangkatmu. Belum ada data yang dikirim. Isian akan hilang jika halaman dimuat ulang atau ditutup.</p></div>
    <div className="feedback-actions"><button type="button" className="feedback-back" onClick={onEdit}><ArrowLeft size={17} aria-hidden="true" />Kembali &amp; Edit</button><button type="button" className="button button-red" disabled aria-describedby="feedback-unavailable">Kirim Feedback</button></div>
  </>
}
