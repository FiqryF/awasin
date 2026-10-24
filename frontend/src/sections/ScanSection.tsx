import { ScrollReveal } from '../components/motion/ScrollReveal'
import { ScanPanel } from '../features/scan/ScanPanel'
import { ScanSidebar } from '../features/scan/ScanSidebar'

export function ScanSection({ personalized = false }: Readonly<{ personalized?: boolean }>) {
  return (
    <section id="periksa" className="scan-section section-space" data-nav-theme="dark" aria-labelledby="scan-title"><div className="page-width">
      <ScrollReveal className="section-heading"><h2 id="scan-title">{personalized ? <>Apa yang ingin kamu <span>periksa hari ini?</span></> : <>Apa yang ingin <span>kamu periksa?</span></>}</h2><p>{personalized ? 'Pilih jenis konten yang ingin kamu periksa bersama AWASIN.' : 'Pilih jenis pemeriksaan, lalu masukkan konten yang ingin dianalisis. Hasil pemeriksaan akan menjelaskan indikasi risiko, bukan menjamin keamanan.'}</p></ScrollReveal>
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-12">
        <ScrollReveal className="min-w-0 lg:col-span-8" delay={0.08}><ScanPanel /></ScrollReveal>
        <ScrollReveal className="min-w-0 lg:col-span-4" delay={0.16}><ScanSidebar /></ScrollReveal>
      </div>
    </div></section>
  )
}
