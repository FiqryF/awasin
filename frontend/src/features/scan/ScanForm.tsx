import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { ArrowUpRight, Info, LockKeyhole } from 'lucide-react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { FileUpload } from './FileUpload'
import { validateFile, validateScanInput } from './scanConfig'
import type { ScanConfig } from './scanConfig'
import { decodeQr, decodedHttpUrl } from './decodeQr'
import { analysisErrorMessage, requestAnalysis } from './analysisApi'
import type { AnalysisInput, AnalysisResult } from './analysisApi'

export function ScanForm({ config, ownerId }: Readonly<{ config: ScanConfig; ownerId?: string }>) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [decoded,setDecoded]=useState<string|null>(null)
  const [decoding,setDecoding]=useState(false)
  const generation=useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  useEffect(() => () => {
    generation.current++
    activeRequest.current?.abort()
  }, [])
  const form = useRef<HTMLFormElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const isUrl = config.id === 'link' || config.id === 'website'
  let submitLabel = 'Periksa Sekarang'
  if (config.id === 'qr') submitLabel = 'Baca QR Code'
  if (decoding) submitLabel = 'Membaca QR…'
  if (submitting && config.id !== 'qr') submitLabel = 'Memeriksa…'

  function clearAnalysis() {
    activeRequest.current?.abort()
    activeRequest.current = null
    setSubmitting(false)
    setRequestError(null)
    setResult(null)
  }

  async function analyze(input: AnalysisInput) {
    clearAnalysis()
    const request = new AbortController()
    activeRequest.current = request
    setSubmitting(true)
    try {
      const next = await requestAnalysis(input, request.signal, ownerId)
      if (!request.signal.aborted) setResult(next)
    } catch (cause) {
      if (!request.signal.aborted) setRequestError(analysisErrorMessage(cause))
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = null
        setSubmitting(false)
      }
    }
  }

  async function readQr(next: File) {
    if (decoding) return
    const current = ++generation.current
    setDecoding(true); setDecoded(null)
    try {
      const value = await decodeQr(next)
      if (current === generation.current) setDecoded(value)
    } catch (error) {
      if (current === generation.current) setError(error instanceof Error ? error.message : 'Gambar QR tidak dapat dibaca. Coba gambar lain.')
    } finally {
      if (current === generation.current) setDecoding(false)
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateScanInput(config.id, text, file)
    setError(validationError)
    clearAnalysis()
    if (validationError) form.current?.querySelector<HTMLElement>(isUrl || config.id === 'message' ? '.text-input' : 'input[type="file"]')?.focus()
    if(validationError)return
    const mode = config.id
    if (mode === 'qr' && file) await readQr(file)
    else if (mode === 'link' || mode === 'website') await analyze({ mode, url: text })
    else if (mode === 'message') {
      if (file) await analyze({ mode, file, ...(text.trim() ? { text } : {}) })
      else await analyze({ mode, text })
    } else if (file) await analyze({ mode, file })
  }

  return (
    <motion.div className="scan-panel" role="tabpanel" id={`panel-${config.id}`} aria-labelledby={`tab-${config.id}`} tabIndex={0}
      initial={reducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}>
      <div className="scan-panel-heading"><h3>{config.title}</h3><p>{config.description}</p></div>
      <form noValidate ref={form} onSubmit={handleSubmit}>
        {(isUrl || config.id === 'message') && <div className="text-field">
          <label className="field-label" htmlFor="scan-text">{config.fieldLabel}</label>
          {isUrl ? <input className="text-input" id="scan-text" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://contoh.com" value={text} maxLength={4096} aria-invalid={Boolean(error)} aria-describedby={error ? 'scan-error' : undefined} onChange={(event) => { setText(event.target.value); setError(null); clearAnalysis() }} />
            : <textarea className="text-input" id="scan-text" rows={4} placeholder="Tempel pesan mencurigakan di sini…" maxLength={10000} value={text} aria-invalid={Boolean(error)} aria-describedby={`message-help${error ? ' scan-error' : ''}`} onChange={(event) => { setText(event.target.value); setError(null); clearAnalysis() }} />}
          {config.id === 'message' && <p className="input-help" id="message-help">Teks minimal 10 karakter, maksimal 10.000. Bisa juga menggunakan screenshot di bawah.</p>}
        </div>}
        {!isUrl && <FileUpload label={config.id === 'message' ? 'Screenshot pesan (opsional)' : config.fieldLabel} video={config.id === 'video'} file={file} error={error} onChange={(next) => {
          generation.current++;setDecoded(null);setDecoding(false)
          clearAnalysis()
          const fileError = next ? validateFile(next, config.id) : null
          setError(fileError); setFile(fileError ? null : next)
        }} />}
        {error && <p id="scan-error" role="alert" className="form-error">{error}</p>}
        <div className="form-bottom">
          <p className="privacy-note"><LockKeyhole size={15} aria-hidden="true" />
            {config.id === 'qr' ? 'Gambar QR dibaca di perangkatmu. Isi QR dikirim hanya saat kamu meminta pemeriksaan.' : 'Input dikirim ke AWASIN untuk validasi dan tidak disimpan ke Riwayat.'}
          </p>
          <button type="submit" className="button button-red" disabled={decoding || submitting}>{submitLabel} <ArrowUpRight size={19} aria-hidden="true" /></button>
        </div>
        {decoded !== null && <section className="qr-decoded" aria-labelledby="qr-decoded-title">
          <h4 id="qr-decoded-title">Isi QR Code</h4><pre>{decoded}</pre>
          <p>Pembacaan QR dilakukan di perangkatmu. Tautan tidak dibuka otomatis.</p>
          {decodedHttpUrl(decoded) && <button type="button" className="button button-red" disabled={submitting} onClick={() => void analyze({ mode: 'qr', payload: decoded })}>Periksa tautan dari QR</button>}
        </section>}
        {requestError && <p className="form-error" role="alert">{requestError}</p>}
        <output className={submitting || result ? 'scan-notice' : 'sr-only'}>
          {submitting && 'Menghubungi layanan pemeriksaan…'}
          {result && <><Info size={20} aria-hidden="true" /><span><strong>{result.explanation}</strong> {result.limitations.join(' ')}</span></>}
        </output>
        {result && result.evidence.length > 0 && <ul className="scan-notice">
          {result.evidence.map(item => <li key={item.id}>{item.explanation} ({item.source})</li>)}
        </ul>}
      </form>
    </motion.div>
  )
}

