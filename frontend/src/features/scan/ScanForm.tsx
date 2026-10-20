import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight, Info, LockKeyhole } from 'lucide-react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { FileUpload } from './FileUpload'
import { validateFile, validateScanInput } from './scanConfig'
import type { ScanConfig } from './scanConfig'

export function ScanForm({ config }: { config: ScanConfig }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const isUrl = config.id === 'link' || config.id === 'website'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateScanInput(config.id, text, file)
    setError(validationError); setSubmitted(!validationError)
    if (validationError) form.current?.querySelector<HTMLElement>(isUrl || config.id === 'message' ? '.text-input' : 'input[type="file"]')?.focus()
  }

  return (
    <motion.div className="scan-panel" role="tabpanel" id={`panel-${config.id}`} aria-labelledby={`tab-${config.id}`} tabIndex={0}
      initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
      <div className="scan-panel-heading"><h3>{config.title}</h3><p>{config.description}</p></div>
      <form noValidate ref={form} onSubmit={handleSubmit}>
        {(isUrl || config.id === 'message') && <div className="text-field">
          <label className="field-label" htmlFor="scan-text">{config.fieldLabel}</label>
          {isUrl ? <input className="text-input" id="scan-text" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://contoh.com" value={text} maxLength={4096} aria-invalid={Boolean(error)} aria-describedby={error ? 'scan-error' : undefined} onChange={(event) => { setText(event.target.value); setError(null); setSubmitted(false) }} />
            : <textarea className="text-input" id="scan-text" rows={4} placeholder="Tempel pesan mencurigakan di sini…" maxLength={10000} value={text} aria-invalid={Boolean(error)} aria-describedby={`message-help${error ? ' scan-error' : ''}`} onChange={(event) => { setText(event.target.value); setError(null); setSubmitted(false) }} />}
          {config.id === 'message' && <p className="input-help" id="message-help">Teks minimal 10 karakter, maksimal 10.000. Bisa juga menggunakan screenshot di bawah.</p>}
        </div>}
        {!isUrl && <FileUpload label={config.id === 'message' ? 'Screenshot pesan (opsional)' : config.fieldLabel} video={config.id === 'video'} file={file} error={error} onChange={(next) => {
          setSubmitted(false)
          const fileError = next ? validateFile(next, config.id) : null
          setError(fileError); setFile(fileError ? null : next)
        }} />}
        {error && <p id="scan-error" role="alert" className="form-error">{error}</p>}
        <div className="form-bottom"><p className="privacy-note"><LockKeyhole size={15} aria-hidden="true" />Input tidak dikirim atau disimpan.</p><button type="submit" className="button button-red">Periksa Sekarang <ArrowUpRight size={19} aria-hidden="true" /></button></div>
        {submitted && <div className="scan-notice" role="status"><Info size={20} aria-hidden="true" /><p><strong>Fitur pemeriksaan sedang dalam pengembangan.</strong> Analisis keamanan belum tersedia. Inputmu belum dianalisis dan tidak dikirim ke layanan mana pun.</p></div>}
      </form>
    </motion.div>
  )
}

