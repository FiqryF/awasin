import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { submitFeedback } from './api'
import { feedbackCategories, feedbackFields } from './feedbackModel'
import type { FeedbackCategory, FeedbackDraft } from './feedbackModel'

export function FeedbackReview({ category, draft, onEdit, owner, submissionKey, onSent, onReset }: Readonly<{ category: FeedbackCategory; draft: FeedbackDraft; onEdit: () => void; owner:string|null; submissionKey:string; onSent:()=>void; onReset:()=>void }>) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('')
  const pending=useRef<AbortController|null>(null)
  useEffect(()=>()=>pending.current?.abort(),[])
  async function send(){
    if(pending.current)return
    const controller=new AbortController();pending.current=controller;setBusy(true);setError('')
    try{const id=await submitFeedback(category,draft,submissionKey,owner,controller.signal);if(!controller.signal.aborted){setReceipt(id);onSent()}}
    catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Feedback belum dapat dikirim.')}
    finally{if(!controller.signal.aborted){setBusy(false);pending.current=null}}
  }
  if(receipt)return <div className="feedback-received"><output>Referensi penerimaan: <strong>{receipt}</strong></output><p>Masukan disimpan untuk peninjauan. Ini bukan konfirmasi bahwa hasil analisis salah dan tidak mengubah klasifikasi laporan. Tidak ada waktu tanggapan atau penyelesaian yang dijanjikan.</p><button type="button" className="button button-red" onClick={onReset}>Kirim masukan lain</button></div>
  const entries = [
    { label: 'Topik', value: feedbackCategories.find(({ id }) => id === category)!.title },
    ...feedbackFields[category].map(({ name, label }) => ({ label, value: draft[name].trim() })),
    { label: 'Email untuk tindak lanjut', value: draft.email.trim() },
    { label: 'Lampiran', value: draft.file?.name ?? '' },
  ].filter(({ value }) => value)
  return <>
    <dl className="feedback-summary">{entries.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="feedback-sensitive">Jangan sertakan password, OTP, atau informasi sensitif di dalam laporan.</p>
    <div className="feedback-availability"><LockKeyhole size={18} aria-hidden="true" /><p>Teks, kontak opsional, dan referensi yang dipilih dikirim saat kamu menekan tombol. Sebelum ada konfirmasi penerimaan dari layanan, masukan masih berupa draf sementara. Lampiran tidak dikirim.</p></div>
    {error&&<p className="feedback-error" role="alert">{error}</p>}
    <div className="feedback-actions"><button type="button" className="feedback-back" disabled={busy} onClick={onEdit}><ArrowLeft size={17} aria-hidden="true" />Kembali &amp; Edit</button><button type="button" className="button button-red" disabled={busy} onClick={()=>void send()}>{busy?'Mengirim…':'Kirim Feedback'}</button></div>
  </>
}
