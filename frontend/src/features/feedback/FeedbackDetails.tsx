import { useRef } from 'react'
import type { ReactNode, SubmitEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { FileUpload } from '../scan/FileUpload'
import { feedbackFields } from './feedbackModel'
import type { FeedbackCategory, FeedbackDraft, FeedbackErrors } from './feedbackModel'

type Props = Readonly<{
  category: FeedbackCategory; draft: FeedbackDraft; errors: FeedbackErrors;
  onChange: (patch: Partial<FeedbackDraft>) => void; onFileChange: (file: File | null) => void;
  onNext: () => void;
}>

export function FeedbackDetails({ category, draft, errors, onChange, onFileChange, onNext }: Props) {
  const form = useRef<HTMLFormElement>(null)
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    onNext()
    // Focus after React commits the inline validation messages.
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }
  return <form ref={form} noValidate onSubmit={submit} className="feedback-fields">
    <p className="feedback-field-hint">Kolom bertanda * wajib diisi.</p>
    <fieldset className="feedback-group"><legend>Isi laporan</legend>
    {feedbackFields[category].map((field) => {
      const id = `feedback-${field.name}`
      const shared = { id, name: field.name, value: draft[field.name], required: field.required, 'aria-invalid': Boolean(errors[field.name]), 'aria-describedby': [field.min ? `${id}-help` : '', errors[field.name] ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined, onChange: (event: { target: { value: string } }) => onChange({ [field.name]: event.target.value }) }
      let control: ReactNode
      if (field.options) {
        const placeholder = field.name === 'feature' ? 'Pilih fitur yang bermasalah' : 'Pilih jenis kesalahan'
        control = <select {...shared}><option value="" disabled hidden>{placeholder}</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
      } else if (field.multiline) {
        control = <textarea {...shared} rows={4} minLength={field.min} maxLength={field.max} placeholder={field.placeholder} />
      } else {
        control = <input {...shared} type="text" minLength={field.min} maxLength={field.max} placeholder={field.placeholder} />
      }
      return <div className="feedback-field" key={field.name}>
        <label htmlFor={id}>{field.label}{field.required ? ' *' : <span>Opsional</span>}</label>
        {control}
        {field.min !== undefined && <p className="feedback-field-hint" id={`${id}-help`}>Minimal {field.min} karakter. Maksimal {field.max.toLocaleString('id-ID')} karakter.</p>}
        {errors[field.name] && <p className="feedback-error" id={`${id}-error`} role="alert">{errors[field.name]}</p>}
      </div>
    })}
    </fieldset>
    <fieldset className="feedback-group"><legend>Kontak &amp; lampiran <span>Opsional</span></legend>
    <div className="feedback-field">
      <label htmlFor="feedback-email">Email untuk tindak lanjut<span>Opsional</span></label>
      <input id="feedback-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="nama@email.com" value={draft.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'feedback-email-error' : 'feedback-email-help'} onChange={(event) => onChange({ email: event.target.value })} />
      <p id="feedback-email-help" className="feedback-field-hint">Kosongkan jika tidak ingin mencantumkan kontak.</p>
      {errors.email && <p className="feedback-error" id="feedback-email-error" role="alert">{errors.email}</p>}
    </div>
    <div className="feedback-attachment">
      <FileUpload label="Lampiran screenshot (opsional)" video={false} file={draft.file} error={errors.file ?? null} onChange={onFileChange} />
      {errors.file && <><p id="scan-error" className="feedback-error" role="alert">{errors.file}</p><button className="feedback-back" type="button" onClick={() => onFileChange(null)}>Lanjut tanpa lampiran</button></>}
      <p className="feedback-field-hint">Pratinjau lokal saja. File belum diunggah ke server.</p>
    </div>
    </fieldset>
    <div className="feedback-privacy-group">
      <label className="feedback-consent"><input id="feedback-privacy" name="privacy" type="checkbox" required checked={draft.privacy} aria-invalid={Boolean(errors.privacy)} aria-describedby={errors.privacy ? 'feedback-privacy-error' : undefined} onChange={(event) => onChange({ privacy: event.target.checked })} /><span>Saya sudah menghapus password, OTP, dan data sensitif dari teks serta lampiran. Saya memahami data akan digunakan untuk meninjau masukan saat pengiriman tersedia.</span></label>
      {errors.privacy && <p id="feedback-privacy-error" className="feedback-error" role="alert">{errors.privacy}</p>}
    </div>
    <div className="feedback-actions feedback-next"><button type="submit" className="button button-red">Tinjau masukan<ArrowRight size={18} aria-hidden="true" /></button></div>
  </form>
}
