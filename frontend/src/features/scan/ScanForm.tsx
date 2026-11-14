import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { ArrowUpRight, Info, LockKeyhole } from 'lucide-react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { FileUpload } from './FileUpload'
import { QrCamera } from './QrCamera'
import { hasHttpScheme, validateFile, validateScanInput } from './scanConfig'
import type { ScanConfig } from './scanConfig'
import { decodeQr, decodedHttpUrl, qrPayloadGuidance } from './decodeQr'
import { analysisErrorMessage, requestAIExplanation, requestAnalysis } from './analysisApi'
import type { AIState, AnalysisInput, AnalysisResult } from './analysisApi'
import { UrlAnalysisReport } from './UrlAnalysisReport'
import { MessageAnalysisReport } from './MessageAnalysisReport'
import './qr.css'

const fullConsent = { threat_lookup_consent: true, enhanced_lookup_consent: true, url_ai_consent: true, openrouter_fallback_consent: true } as const
const messageFullConsent = {
  message_ai_consent: true,
  message_openrouter_consent: true,
  message_link_consent: true,
  message_link_enhanced_consent: true,
} as const

export function ScanForm({ config, ownerId, onHistorySaved }: Readonly<{ config: ScanConfig; ownerId?: string; onHistorySaved?: () => void }>) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [consent, setConsent] = useState(false)
  const [messageMode, setMessageMode] = useState<'text' | 'screenshot'>('text')
  const [messageHistory, setMessageHistory] = useState(false)
  const [ai, setAi] = useState<AIState | null>(null)
  const [decoded,setDecoded]=useState<string|null>(null)
  const [qrConsent,setQrConsent]=useState(false)
  const [decoding,setDecoding]=useState(false)
  const generation=useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  useEffect(() => () => {
    generation.current++
    activeRequest.current?.abort()
  }, [])
  const form = useRef<HTMLFormElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const isUrl = config.id === 'link'
  const isMessage = config.id === 'message'
  const screenshot = isMessage && messageMode === 'screenshot'
  const decodedUrl = config.id === 'qr' && decoded !== null ? decodedHttpUrl(decoded) : null
  let submitLabel = 'Periksa Sekarang'
  if (config.id === 'qr') submitLabel = 'Baca QR Code'
  if (decoding) submitLabel = 'Membaca QR…'
  if (submitting) submitLabel = config.id === 'qr' ? 'Memeriksa tautan…' : 'Memeriksa…'

  function clearAnalysis() {
    activeRequest.current?.abort()
    activeRequest.current = null
    setSubmitting(false)
    setRequestError(null)
    setResult(null)
    setAi(null)
  }

  async function analyze(input: AnalysisInput) {
    clearAnalysis()
    const request = new AbortController()
    activeRequest.current = request
    setSubmitting(true)
    try {
      const next = await requestAnalysis(input, request.signal, ownerId)
      if (request.signal.aborted) return
      const { ai: offer, ...fallback } = next
      if (input.mode === 'message' && (!ownerId || input.history_consent !== true)) delete fallback.history_status
      setResult(fallback)
      if (fallback.history_status === 'saved') onHistorySaved?.()
      setSubmitting(false)
      if ('url_ai_consent' in input && input.url_ai_consent && next.url_report) {
        if (offer?.status !== 'pending') {
          setAi({ status: offer?.status ?? 'unavailable' })
          return
        }
        setAi({ status: 'loading' })
        try {
          const explanation = await requestAIExplanation(offer.ticket, request.signal, ownerId)
          if (!request.signal.aborted) {
            if (explanation.history_status === 'saved') onHistorySaved?.()
            setAi(explanation.status === 'completed' && explanation.risk == null
              ? { ...explanation, status: 'validation_failed' }
              : explanation)
          }
        } catch (cause) {
          if (!request.signal.aborted) {
            setAi({ status: cause instanceof Error && cause.name === 'TimeoutError' ? 'timeout' : 'unavailable' })
          }
        }
      }
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
    setDecoding(true); setDecoded(null); setQrConsent(false)
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
    const validationError = screenshot && !file ? 'Pilih screenshot pesan terlebih dahulu.' : validateScanInput(config.id, text, file)
    setError(validationError)
    clearAnalysis()
    if (validationError) form.current?.querySelector<HTMLElement>(isUrl || (isMessage && !screenshot) ? '.text-input' : 'input[type="file"]')?.focus()
    if(validationError)return
    const mode = config.id
    if (mode === 'qr' && file) await readQr(file)
    else if (mode === 'link') {
      setConsent(false)
      await analyze({
        mode: hasHttpScheme(text) ? 'link' : 'website', url: text,
        ...(consent ? fullConsent : {}),
        ...(ownerId ? { history_consent: true } : {}),
      })
    }
    else if (mode === 'message') {
      const options = {
        ...(consent ? messageFullConsent : {}),
        ...(ownerId && messageHistory ? { history_consent: true } : {}),
      }
      setConsent(false); setMessageHistory(false)
      if (screenshot && file) await analyze({ mode, file, ...options })
      else await analyze({ mode, text, ...options })
    } else if (file) await analyze({ mode, file })
  }

  return (
    <motion.div className="scan-panel" role="tabpanel" id={`panel-${config.id}`} aria-labelledby={`tab-${config.id}`} tabIndex={0}
      initial={reducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}>
      <div className="scan-panel-heading"><h3>{config.title}</h3><p>{config.description}</p></div>
      <form noValidate ref={form} onSubmit={handleSubmit}>
        {isMessage && <fieldset className="message-mode"><legend>Pilih input pesan</legend>
          {(['text', 'screenshot'] as const).map(mode => <label key={mode}>
            <input type="radio" name="message-mode" checked={messageMode === mode} onChange={() => {
              setMessageMode(mode); setError(null); setConsent(false); setMessageHistory(false); clearAnalysis()
            }} /> {mode === 'text' ? 'Teks Pesan' : 'Screenshot'}
          </label>)}
        </fieldset>}
        {(isUrl || (isMessage && !screenshot)) && <div className="text-field">
          <label className="field-label" htmlFor="scan-text">{config.fieldLabel}</label>
          {isUrl ? <input className="text-input" id="scan-text" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="Masukkan tautan atau domain website…" value={text} maxLength={4096} aria-invalid={Boolean(error)} aria-describedby={`url-help${error ? ' scan-error' : ''}`} onChange={(event) => { setText(event.target.value); setConsent(false); setError(null); clearAnalysis() }} />
            : <textarea className="text-input" id="scan-text" rows={4} placeholder="Tempel pesan mencurigakan di sini…" maxLength={10000} value={text} aria-invalid={Boolean(error)} aria-describedby={`message-help${error ? ' scan-error' : ''}`} onChange={(event) => { setText(event.target.value); setConsent(false); setMessageHistory(false); setError(null); clearAnalysis() }} />}
          {isMessage && <p className="input-help" id="message-help">Minimal 10 karakter. {text.length.toLocaleString('id-ID')} / 10.000 karakter.</p>}
          {isUrl && <p className="input-help" id="url-help">AWASIN memeriksa struktur alamat dan mencocokkan domain dengan referensi resmi yang tersedia.</p>}
        </div>}
        {!isUrl && (!isMessage || screenshot) && <FileUpload label={isMessage ? 'Screenshot pesan' : config.fieldLabel} video={config.id === 'video'} file={file} error={error} onChange={(next) => {
          generation.current++;setDecoded(null);setDecoding(false);setQrConsent(false)
          clearAnalysis()
          const fileError = next ? validateFile(next, config.id) : null
          if (isMessage) { setConsent(false); setMessageHistory(false) }
          setError(fileError); setFile(fileError ? null : next)
        }} />}
        {(isUrl || isMessage) && <div className="scan-consent">
          <label className="scan-lookup-consent">
            <input type="checkbox" checked={consent} aria-describedby="scan-consent-help" onChange={event => setConsent(event.target.checked)} />
            <span>Izinkan pemeriksaan lengkap</span>
          </label>
          <p className="input-help" id="scan-consent-help">{isMessage
            ? 'Mistral atau cadangan Nemotron via OpenRouter menganalisis teks yang disaring. Link & Web dapat memeriksa tautan publik lewat Google, VirusTotal, urlscan.io, DNS, dan RDAP. Hapus data pribadi sebelum memeriksa.'
            : 'URL publik yang lolos penyaringan dapat diperiksa oleh Mistral, Nemotron melalui OpenRouter, Google, VirusTotal, dan urlscan.io. Jangan masukkan tautan berisi data pribadi atau token.'}</p>
          <p className="input-help">{isMessage
            ? 'AWASIN bisa saja salah. Periksa kembali lewat kanal resmi sebelum membuka tautan, mengirim uang, atau membagikan data pribadi.'
            : 'AWASIN bisa saja salah. Periksa kembali lewat kanal resmi sebelum memasukkan data sensitif.'}</p>
          {isMessage && ownerId && <button className="message-history-toggle" type="button" aria-pressed={messageHistory}
            onClick={() => setMessageHistory(!messageHistory)}>Simpan ringkasan ke Riwayat</button>}
        </div>}
        {config.id === 'qr' && <QrCamera key={file ? `${file.name}-${file.lastModified}` : 'no-file'} disabled={Boolean(file)} onDecoded={value => {
          generation.current++
          setDecoded(value)
          setQrConsent(false)
          setError(null)
          clearAnalysis()
        }} />}
        {error && <p id="scan-error" role="alert" className="form-error">{error}</p>}
        <div className="form-bottom">
          <p className="privacy-note"><LockKeyhole size={15} aria-hidden="true" />
            {isMessage ? 'Teks asli dan screenshot tidak disimpan ke Riwayat.' : config.id === 'qr' ? <>Gambar QR dibaca di perangkatmu. Isi QR dikirim ke backend hanya saat kamu memilih analisis dan menyetujui pengiriman; payload tidak disimpan atau diteruskan ke provider eksternal.{ownerId && ' Ringkasan QR tidak disimpan ke Riwayat.'}</> : isUrl && ownerId ? 'Ringkasan hasil disimpan ke Riwayat jika penyimpanan aktif. URL lengkap tidak disimpan.' : 'Input dikirim ke AWASIN untuk validasi dan tidak disimpan ke Riwayat.'}
          </p>
          <button type="submit" className="button button-red" disabled={decoding || submitting}>{submitLabel} <ArrowUpRight size={19} aria-hidden="true" /></button>
        </div>
        {decoded !== null && <section className="qr-decoded" aria-labelledby="qr-decoded-title">
          <h4 id="qr-decoded-title">Isi QR Code</h4><pre>{decoded}</pre>
          <p>{decodedUrl ? 'Pembacaan QR dilakukan di perangkatmu. Tautan tidak dibuka otomatis; pemeriksaan hanya berjalan jika kamu memilih tombol berikut.' : qrPayloadGuidance(decoded)}</p>
          {decodedUrl && <button type="button" className="button button-red" disabled={submitting} onClick={() => void analyze({
            mode: hasHttpScheme(decoded) ? 'link' : 'website',
            url: decodedUrl,
            ...(ownerId ? { history_consent: true } : {}),
          })}>Periksa tautan dari QR</button>}
          {decodedUrl === null && <div className="qr-backend-consent">
            <label>
              <input type="checkbox" checked={qrConsent} onChange={event => setQrConsent(event.target.checked)} />
              <span>Saya setuju mengirim isi QR ini ke backend AWASIN untuk pemeriksaan format dan panduan keamanan.</span>
            </label>
            <p className="input-help">Payload dapat berisi kata sandi Wi-Fi atau informasi kontak. Analisis tidak menyimpannya, tidak meneruskannya ke provider eksternal, dan tidak memastikan bahwa isi QR aman.</p>
            <button type="button" className="button button-red" disabled={!qrConsent || submitting} onClick={() => void analyze({
              mode: 'qr', payload: decoded, payload_consent: true,
            })}>Analisis isi QR di backend</button>
          </div>}
        </section>}
        {requestError && <p className="form-error" role="alert">{requestError}</p>}
        <output className={submitting || (result && !result.url_report && !result.message_report) ? 'scan-notice' : 'sr-only'}>
          {submitting && 'Menghubungi layanan pemeriksaan…'}
          {result && !result.url_report && !result.message_report && <><Info size={20} aria-hidden="true" /><span><strong>{result.explanation}</strong> {result.limitations.join(' ')}</span></>}
        </output>
        {result?.url_report && <UrlAnalysisReport result={result} ai={ai} />}
        {result?.message_report && <MessageAnalysisReport result={result} onEditText={preview => {
          clearAnalysis(); setMessageMode('text'); setText(preview)
        }} />}
        {result && !result.url_report && !result.message_report && result.evidence.length > 0 && <ul className="scan-notice">
          {result.evidence.map(item => <li key={item.id}>{item.explanation} ({item.source})</li>)}
        </ul>}
      </form>
    </motion.div>
  )
}
