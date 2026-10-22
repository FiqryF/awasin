import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowLeft, ArrowUpRight, Check, LockKeyhole } from 'lucide-react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { FeedbackDetails } from '../features/feedback/FeedbackDetails'
import { FeedbackReview } from '../features/feedback/FeedbackReview'
import { emptyFeedback, feedbackCategories, readFeedbackEntry, validateFeedback } from '../features/feedback/feedbackModel'
import type { FeedbackCategory, FeedbackDraft, FeedbackErrors, FeedbackStep } from '../features/feedback/feedbackModel'
import { validateFile } from '../features/scan/scanConfig'
import './feedback.css'

const stages = ['Pilih topik', 'Ceritakan', 'Tinjau ulang']
const stepHeadings: Record<FeedbackStep, string> = {
  1: 'Apa yang ingin kamu sampaikan?',
  2: 'Ceritakan dari sudut pandangmu.',
  3: 'Sudah sesuai dengan yang ingin kamu sampaikan?',
}

export function FeedbackPage() {
  const { state } = useLocation()
  const [entry] = useState(() => readFeedbackEntry(state))
  const [category, setCategory] = useState<FeedbackCategory | null>(entry.category)
  const [step, setStep] = useState<FeedbackStep>(entry.category ? 2 : 1)
  const [draft, setDraft] = useState<FeedbackDraft>({ ...emptyFeedback, scanReference: entry.scanReference })
  const [errors, setErrors] = useState<FeedbackErrors>({})
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const reducedMotion = usePrefersReducedMotion()
  useEffect(() => {
    if (previousStep.current !== step) {
      heading.current?.focus({ preventScroll: true })
      const bounds = heading.current?.getBoundingClientRect()
      if (bounds && (bounds.top < 100 || bounds.bottom > window.innerHeight)) heading.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
    }
    previousStep.current = step
  }, [step, reducedMotion])

  function updateDraft(patch: Partial<FeedbackDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setErrors((current) => {
      const next = { ...current }
      for (const name of Object.keys(patch) as (keyof FeedbackDraft)[]) delete next[name]
      return next
    })
  }
  function selectCategory(next: FeedbackCategory) { setCategory(next); setErrors({}); setStep(2) }
  function selectFile(file: File | null) {
    const error = file ? validateFile(file, 'image') : null
    if (error) { setErrors((current) => ({ ...current, file: error })); return }
    updateDraft({ file })
  }
  function review() {
    if (!category) return
    const next = validateFeedback(category, draft)
    if (errors.file) next.file = errors.file
    setErrors(next)
    if (Object.keys(next).length === 0) setStep(3)
  }
  const selected = feedbackCategories.find(({ id }) => id === category)
  const title = stepHeadings[step]
  return <section className="feedback-page" aria-labelledby="feedback-page-title">
    <div className="feedback-atmosphere" aria-hidden="true"><span className="feedback-ribbon" /><span className="feedback-ribbon" /></div>
    <div className="page-width feedback-topbar"><Link to="/" className="feedback-home"><ArrowLeft size={18} aria-hidden="true" />Kembali ke beranda</Link><span>Langkah {step} dari 3</span></div>
    <div className="page-width feedback-layout">
      <div className="feedback-editorial">
        <p className="feedback-eyebrow">AWASIN / FEEDBACK</p>
        <h1 id="feedback-page-title"><motion.span initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.4 }}>Ada yang perlu</motion.span>{' '}<motion.span initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : 0.08 }}>kami dengar<span className="feedback-question">?</span></motion.span></h1>
        <p className="feedback-intro">Setiap masukan membantu AWASIN menjadi lebih baik. Ceritakan pengalamanmu, laporkan kesalahan, atau bagikan ide yang ingin kamu lihat.</p>
        <div className="feedback-progress" aria-label={`Langkah ${step} dari 3: ${stages[step - 1]}`}>
          <div className="feedback-step-number" aria-hidden="true"><motion.span key={step} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>0{step}</motion.span><span>/ 03</span></div>
          <ol>{stages.map((stage, index) => <li key={stage} aria-current={step === index + 1 ? 'step' : undefined} className={step > index + 1 ? 'is-done' : ''}><span className="feedback-stage-mark" aria-hidden="true">{step > index + 1 ? <Check size={12} /> : index + 1}</span>{stage}</li>)}</ol>
        </div>
        <p className="feedback-local-note"><LockKeyhole size={15} aria-hidden="true" />Tanpa login. Draf hanya di perangkatmu.</p>
      </div>
      <div className={`feedback-experience${step > 1 ? ' feedback-sheet' : ''}`}>
        <output className="sr-only" aria-live="polite">Langkah {step} dari 3: {stages[step - 1]}</output>
        <motion.div key={step} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}>
          <div className="feedback-step-header"><div className="feedback-step-context">{step === 2 && <button type="button" className="feedback-change-topic" onClick={() => setStep(1)}><ArrowLeft size={16} aria-hidden="true" />Ganti topik</button>}<p>{step === 1 ? 'Pilih satu topik di bawah untuk melanjutkan' : selected?.title}</p></div><h2 tabIndex={-1} ref={heading}>{title}</h2></div>
          {step === 1 && <div className="feedback-categories">{feedbackCategories.map(({ id, title: label, description }, index) => <button key={id} type="button" aria-pressed={category === id} onClick={() => selectCategory(id)}><span className="feedback-category-number">0{index + 1}</span><span className="feedback-category-copy"><strong>{label}</strong><span>{description}</span></span><ArrowUpRight size={21} aria-hidden="true" /></button>)}</div>}
          {step === 2 && category && <FeedbackDetails category={category} draft={draft} errors={errors} onChange={updateDraft} onFileChange={selectFile} onNext={review} />}
          {step === 3 && category && <FeedbackReview category={category} draft={draft} onEdit={() => setStep(2)} />}
          {step === 1 && <p className="feedback-start-note">Pilih topik untuk mulai bercerita. Pengiriman ke tim AWASIN belum tersedia.</p>}
        </motion.div>
      </div>
    </div>
  </section>
}

