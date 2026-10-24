import { isValidEmail } from '../../utils/isValidEmail'
import { validReportId } from '../history/contracts'

export const feedbackCategories = [
  { id: 'detection', title: 'Kesalahan Deteksi', description: 'Laporkan hasil pemeriksaan yang menurutmu tidak tepat.' },
  { id: 'bug', title: 'Laporkan Bug', description: 'Beri tahu kami jika ada fitur atau halaman yang bermasalah.' },
  { id: 'idea', title: 'Ide & Saran', description: 'Bagikan gagasan untuk membuat AWASIN lebih bermanfaat.' },
  { id: 'other', title: 'Feedback Lainnya', description: 'Sampaikan kritik, pengalaman, atau masukan umum.' },
] as const

export type FeedbackCategory = typeof feedbackCategories[number]['id']
export type FeedbackStep = 1 | 2 | 3
export type FeedbackValues = {
  errorType: string; scanReference: string; feature: string; title: string;
  description: string; reproduction: string; benefit: string; email: string;
}
export type FeedbackDraft = FeedbackValues & { file: File | null; privacy: boolean }
export type FeedbackErrors = Partial<Record<keyof FeedbackDraft, string>>
export type FeedbackField = Readonly<{
  name: keyof FeedbackValues; label: string; required?: boolean; multiline?: boolean;
  placeholder?: string; options?: readonly string[]; max: number; min?: number;
}>

export const emptyFeedback: FeedbackDraft = {
  errorType: '', scanReference: '', feature: '', title: '', description: '',
  reproduction: '', benefit: '', email: '', file: null, privacy: false,
}

const description = (label: string): FeedbackField => ({ name: 'description', label, required: true, multiline: true, min: 10, max: 5000, placeholder: 'Ceritakan dengan jelas. Jangan sertakan data sensitif.' })
export const feedbackFields: Record<FeedbackCategory, readonly FeedbackField[]> = {
  detection: [
    { name: 'errorType', label: 'Jenis kesalahan', required: true, max: 120, options: ['Konten berisiko dinilai aman', 'Konten aman dinilai berisiko', 'Hasil analisis tidak sesuai / lainnya'] },
    { name: 'scanReference', label: 'ID Pemeriksaan', max: 120, placeholder: 'Isi jika kamu memiliki referensi pemeriksaan' },
    description('Penjelasan masalah'),
  ],
  bug: [
    { name: 'feature', label: 'Halaman atau fitur yang bermasalah', required: true, max: 120, options: ['Link Inspector', 'Message Analyzer', 'Fake Website Detector', 'QR Code Scanner', 'AI Media Analyzer', 'Login/Register', 'Lainnya'] },
    description('Deskripsi masalah'),
    { name: 'reproduction', label: 'Langkah untuk mereproduksi masalah', multiline: true, max: 2000, placeholder: 'Apa yang kamu lakukan sebelum masalah muncul?' },
  ],
  idea: [
    { name: 'title', label: 'Judul ide', required: true, min: 5, max: 120, placeholder: 'Beri idemu judul singkat' },
    description('Penjelasan ide'),
    { name: 'benefit', label: 'Dampak atau manfaat yang diharapkan', multiline: true, max: 1000 },
  ],
  other: [{ name: 'title', label: 'Judul feedback', max: 120 }, description('Deskripsi feedback')],
}

function feedbackFieldError(field: FeedbackField, value: string): string | undefined {
  if (field.required && value.length < (field.min ?? 1)) return field.min ? `Isi sedikitnya ${field.min} karakter.` : 'Pilih salah satu opsi.'
  if (value.length > field.max) return `Batasi hingga ${field.max.toLocaleString('id-ID')} karakter.`
  if (value && field.options && !field.options.includes(value)) return 'Pilih opsi yang tersedia.'
  return undefined
}

export function validateFeedback(category: FeedbackCategory, draft: FeedbackDraft): FeedbackErrors {
  const errors: FeedbackErrors = {}
  for (const field of feedbackFields[category]) {
    const message = feedbackFieldError(field, draft[field.name].trim())
    if (message) errors[field.name] = message
  }
  const email = draft.email.trim()
  if (email && !isValidEmail(email)) errors.email = 'Masukkan alamat email yang valid, atau kosongkan.'
  if (!draft.privacy) errors.privacy = 'Setujui pernyataan privasi untuk melanjutkan.'
  if(category==='detection'&&draft.scanReference.trim()&&!validReportId(draft.scanReference.trim()))errors.scanReference='Gunakan ID laporan tersimpan yang valid, atau kosongkan.'
  if(draft.file)errors.file='Pengiriman lampiran belum tersedia. Hapus lampiran sebelum melanjutkan.'
  return errors
}

// Pass real report references through React Router state, never scan content in a URL.
export function readFeedbackEntry(state: unknown): { category: FeedbackCategory | null; scanReference: string } {
  if (!state || typeof state !== 'object') return { category: null, scanReference: '' }
  const entry = state as Record<string, unknown>
  const category = feedbackCategories.find(({ id }) => id === entry.feedbackCategory)?.id ?? null
  const scanReference = typeof entry.scanReference === 'string' ? entry.scanReference.trim().slice(0, 120) : ''
  return { category, scanReference: category === 'detection' ? scanReference : '' }
}
