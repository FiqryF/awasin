import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { HomeBackLink } from '../components/ui/HomeBackLink'
import { ArrowLeft, ArrowUpRight, Check, LockKeyhole } from 'lucide-react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { FeedbackDetails } from '../features/feedback/FeedbackDetails'
import { FeedbackReview } from '../features/feedback/FeedbackReview'
import { emptyFeedback, feedbackCategories, readFeedbackEntry, validateFeedback } from '../features/feedback/feedbackModel'
import type { FeedbackCategory, FeedbackDraft, FeedbackErrors, FeedbackStep } from '../features/feedback/feedbackModel'
import { useAuth } from '../features/auth/useAuth'
import './feedback.css'

const stages = ['Pilih topik', 'Ceritakan', 'Tinjau ulang']
const stepHeadings: Record<FeedbackStep, string> = {
  1: 'Apa yang ingin kamu sampaikan?',
  2: 'Ceritakan dari sudut pandangmu.',
  3: 'Sudah sesuai dengan yang ingin kamu sampaikan?',
}

function focusFeedbackHeading(heading: HTMLHeadingElement | null, reducedMotion: boolean) {
  if (!heading) return
  heading.focus({ preventScroll: true })
  const bounds = heading.getBoundingClientRect()
  if (bounds.top < 100 || bounds.bottom > window.innerHeight) heading.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
}

function FeedbackTopics({category,onSelect}:Readonly<{category:FeedbackCategory|null;onSelect:(category:FeedbackCategory)=>void}>) {
  return <div className="feedback-categories">{feedbackCategories.map(({ id, title, description }, index) => <button key={id} type="button" aria-pressed={category === id} onClick={() => onSelect(id)}><span className="feedback-category-number">0{index + 1}</span><span className="feedback-category-copy"><strong>{title}</strong><span>{description}</span></span><ArrowUpRight size={21} aria-hidden="true" /></button>)}</div>
}

function feedbackStatus(step: FeedbackStep, sent: boolean, owner: string | null) {
  const title = sent ? 'Masukan telah diterima.' : stepHeadings[step]
  const labels = sent ? ['Pilih topik', 'Ceritakan', 'Selesai'] : stages
  const identityNote = owner ? 'Terhubung dengan akunmu.' : 'Dapat dikirim tanpa login.'
  const localNote = sent ? 'Masukan diterima. Isian sementara sudah dikosongkan.' : `${identityNote} Draf belum dikirim sebelum konfirmasi layanan.`
  return { title, labels, localNote }
}

export function FeedbackPage() {
  const location = useLocation()
  const {identity,loading,error,refresh}=useAuth()
  if(loading)return <section className="page-width placeholder-main"><h1>Feedback</h1><output>Memverifikasi sesi sebelum membuka formulir…</output></section>
  if(error)return <section className="page-width placeholder-main"><h1>Feedback belum dapat dibuka.</h1><p role="alert">Sesi akun belum dapat diverifikasi. Coba lagi sebelum mengisi atau mengirim masukan.</p><button type="button" className="button button-red" onClick={()=>void refresh()}>Coba lagi</button><Link className="auth-link" to="/login">Masuk kembali</Link></section>
  return <FeedbackContent key={`${identity?.id??'guest'}:${location.key}`} owner={identity?.id??null} state={location.state}/>
}
function FeedbackContent({owner,state}:Readonly<{owner:string|null;state:unknown}>) {
  const [entry] = useState(() => {const parsed=readFeedbackEntry(state);return {...parsed,scanReference:owner?parsed.scanReference:''}})
  const [category, setCategory] = useState<FeedbackCategory | null>(entry.category)
  const [step, setStep] = useState<FeedbackStep>(entry.category ? 2 : 1)
  const [draft, setDraft] = useState<FeedbackDraft>({ ...emptyFeedback, scanReference: entry.scanReference })
  const [errors, setErrors] = useState<FeedbackErrors>({})
  const [submissionKey,setSubmissionKey]=useState(()=>crypto.randomUUID())
  const [sent,setSent]=useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const reducedMotion = usePrefersReducedMotion()
  useEffect(() => {
    if (previousStep.current !== step || sent) {
      focusFeedbackHeading(heading.current, reducedMotion)
    }
    previousStep.current = step
  }, [step, reducedMotion, sent])

  function updateDraft(patch: Partial<FeedbackDraft>) {
    setSubmissionKey(crypto.randomUUID())
    setDraft((current) => ({ ...current, ...patch }))
    setErrors((current) => {
      const next = { ...current }
      for (const name of Object.keys(patch) as (keyof FeedbackDraft)[]) delete next[name]
      return next
    })
  }
  function selectCategory(next: FeedbackCategory) { setCategory(next); setErrors({}); setSubmissionKey(crypto.randomUUID()); setStep(2) }
  function review() {
    if (!category) return
    const next = validateFeedback(category, draft)
    if (errors.file) next.file = errors.file
    setErrors(next)
    if (Object.keys(next).length === 0) setStep(3)
  }
  const selected = feedbackCategories.find(({ id }) => id === category)
  const { title, labels, localNote } = feedbackStatus(step, sent, owner)
  return <section className="feedback-page" aria-labelledby="feedback-page-title">
    <div className="feedback-atmosphere" aria-hidden="true"><span className="feedback-ribbon" /><span className="feedback-ribbon" /></div>
    <div className="page-width feedback-topbar"><HomeBackLink to={owner?'/dashboard':'/'}/><span>Langkah {step} dari 3</span></div>
    <div className="page-width feedback-layout">
      <div className="feedback-editorial">
        <p className="feedback-eyebrow">AWASIN / FEEDBACK</p>
        <h1 id="feedback-page-title"><motion.span initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.4 }}>Ada yang perlu</motion.span>{' '}<motion.span initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : 0.08 }}>kami dengar<span className="feedback-question">?</span></motion.span></h1>
        <p className="feedback-intro">Setiap masukan membantu AWASIN menjadi lebih baik. Ceritakan pengalamanmu, laporkan kesalahan, atau bagikan ide yang ingin kamu lihat.</p>
        <div className="feedback-progress" aria-label={`Langkah ${step} dari 3: ${labels[step - 1]}`}>
          <div className="feedback-step-number" aria-hidden="true"><motion.span key={step} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>0{step}</motion.span><span>/ 03</span></div>
          <ol>{labels.map((stage, index) => <li key={stage} aria-current={step === index + 1 ? 'step' : undefined} className={step > index + 1 ? 'is-done' : ''}><span className="feedback-stage-mark" aria-hidden="true">{step > index + 1 ? <Check size={12} /> : index + 1}</span>{stage}</li>)}</ol>
        </div>
        <p className="feedback-local-note"><LockKeyhole size={15} aria-hidden="true" />{localNote}</p>
      </div>
      <div className={`feedback-experience${step > 1 ? ' feedback-sheet' : ''}`}>
        <output className="sr-only" aria-live="polite">Langkah {step} dari 3: {labels[step - 1]}</output>
        <motion.div key={step} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}>
          <div className="feedback-step-header"><div className="feedback-step-context">{step === 2 && <button type="button" className="feedback-change-topic" onClick={() => setStep(1)}><ArrowLeft size={16} aria-hidden="true" />Ganti topik</button>}<p>{step === 1 ? 'Pilih satu topik di bawah untuk melanjutkan' : selected?.title}</p></div><h2 tabIndex={-1} ref={heading}>{title}</h2></div>
          {step === 1 && <FeedbackTopics category={category} onSelect={selectCategory} />}
          {step === 2 && category && <FeedbackDetails category={category} draft={draft} errors={errors} authenticated={Boolean(owner)} onChange={updateDraft} onNext={review} />}
          {step === 3 && category && <FeedbackReview category={category} draft={draft} owner={owner} submissionKey={submissionKey} onEdit={() => setStep(2)} onSent={()=>{setDraft({...emptyFeedback});setSent(true)}} onReset={()=>{setDraft({...emptyFeedback});setSent(false);setCategory(null);setStep(1);setSubmissionKey(crypto.randomUUID())}} />}
          {step === 1 && <p className="feedback-start-note">Pilih topik untuk mulai bercerita. Jangan sertakan data sensitif. Masukan baru dianggap diterima setelah layanan mengonfirmasinya.</p>}
        </motion.div>
      </div>
    </div>
  </section>
}

