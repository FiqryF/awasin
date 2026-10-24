import { supabase } from '../auth/client'
import { API_BASE_URL } from '../../services/api'
import { feedbackFields, validateFeedback } from './feedbackModel'
import type { FeedbackCategory, FeedbackDraft } from './feedbackModel'
import { validReportId } from '../history/contracts'

export async function submitFeedback(category:FeedbackCategory,draft:FeedbackDraft,submissionKey:string,owner:string|null,signal:AbortSignal) {
  if(Object.keys(validateFeedback(category,draft)).length||draft.file)throw new Error('Periksa isian dan hapus lampiran. Pengiriman screenshot belum tersedia.')
  const {data,error}=supabase?await supabase.auth.getSession():{data:{session:null},error:null}
  if(error)throw new Error('Sesi tidak dapat diverifikasi. Coba lagi sebelum mengirim.')
  if((data.session?.user.id??null)!==owner)throw new Error('Akun aktif berubah atau belum terverifikasi. Buka kembali halaman Feedback.')
  const fields=Object.fromEntries(feedbackFields[category].filter(field=>field.name!=='scanReference').map(field=>[field.name,draft[field.name].trim()]).filter(([,value])=>value))
  let response:Response
  try{response=await fetch(`${API_BASE_URL}/api/v1/feedback`,{method:'POST',cache:'no-store',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:{'Content-Type':'application/json',...(data.session?{Authorization:`Bearer ${data.session.access_token}`}:{})},body:JSON.stringify({submission_key:submissionKey,category,fields,contact_email:draft.email.trim()||null,report_id:category==='detection'?draft.scanReference.trim()||null:null,consent:draft.privacy})})}
  catch{throw new Error('Penerimaan belum dapat dikonfirmasi. Periksa koneksi dan coba lagi; isian tetap tersedia.')}
  if(!response.ok){
    if(response.status===429)throw new Error('Terlalu banyak permintaan. Tunggu 10 menit sebelum mencoba lagi.')
    if([401,403,404].includes(response.status))throw new Error('Sesi atau referensi laporan tidak dapat digunakan. Periksa akun dan pilih laporan tersimpan milikmu.')
    if(response.status===422||response.status===413)throw new Error('Isian tidak valid atau terlalu besar. Tinjau kembali masukanmu.')
    throw new Error('Feedback belum dapat diterima. Layanan pengiriman mungkin sedang tidak tersedia; coba lagi nanti.')
  }
  const receipt:unknown=await response.json()
  if(!receipt||typeof receipt!=='object'||!('receipt_id' in receipt)||!validReportId(receipt.receipt_id))throw new Error('Konfirmasi penerimaan tidak valid. Jangan anggap masukan sudah diterima.')
  return receipt.receipt_id
}
