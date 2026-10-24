import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FileText, ShieldCheck, X } from 'lucide-react'
import { legalDocuments, legalVersion } from './legalContent'
import type { LegalDocumentKind } from './legalContent'
import './legal.css'

export function LegalDialog({ kind, onClose }: Readonly<{ kind: LegalDocumentKind; onClose: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const content = legalDocuments[kind]
  const Icon = kind === 'terms' ? FileText : ShieldCheck

  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const previousPadding = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.paddingRight = `${Number.parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth}px`
    document.body.style.overflow = 'hidden'
    element.setAttribute('closedby', 'any')
    element.showModal()
    title.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPadding
      queueMicrotask(() => {
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
      })
    }
  }, [])

  return createPortal(
    <dialog ref={dialog} className="legal-dialog" aria-labelledby="legal-title" aria-describedby="legal-summary" onClose={() => { if (!dialog.current?.open) onClose() }}>
      <header className="legal-header">
        <div className="legal-heading"><Icon size={24} aria-hidden="true" /><div><h2 id="legal-title" tabIndex={-1} ref={title}>{content.title}</h2><p>Diperbarui {legalVersion}</p></div></div>
        <button type="button" className="legal-close" onClick={onClose} aria-label="Tutup dokumen" title="Tutup dokumen"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="legal-body">
        <p className="legal-summary" id="legal-summary">{content.summary}</p>
        <p className="legal-status"><strong>Versi pengembangan.</strong> Akun, riwayat, preferensi, dan Feedback bergantung pada aktivasi layanan oleh pengelola. Perhatikan konfirmasi setiap tindakan. Analisis keamanan belum tersedia.</p>
        <nav className="legal-contents" aria-label="Daftar isi dokumen"><h3>Dalam dokumen ini</h3><ol>{content.sections.map((section, index) => <li key={section.title}><a href={`#legal-section-${index}`} onClick={(event) => { event.preventDefault(); document.getElementById(`legal-section-${index}`)?.scrollIntoView({ block: 'start', behavior: 'instant' }); document.getElementById(`legal-section-${index}`)?.focus({ preventScroll: true }) }}>{section.title}</a></li>)}</ol></nav>
        {content.sections.map((section, index) => <section className="legal-section" key={section.title}>
          <h3 id={`legal-section-${index}`} tabIndex={-1}>{section.title}</h3>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>)}
        {kind === 'privacy' && <p className="legal-reference">Rujukan hak subjek data: <a href="https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022" target="_blank" rel="noopener noreferrer">UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (BPK, dibuka di tab baru)</a>.</p>}
      </div>
      <footer className="legal-footer"><p>Membaca dokumen tidak mengubah pilihan persetujuan Anda.</p><button type="button" className="button button-red" onClick={onClose}>Tutup dokumen</button></footer>
    </dialog>, document.body,
  )
}
