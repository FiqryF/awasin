import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useEducation } from '../features/education/useEducation'
import { useAuth } from '../features/auth/useAuth'
import './education.css'

export function EducationPage() {
  const {identity}=useAuth()
  const resource=useEducation()
  const articles=resource.items
  return <section className="education-page" aria-labelledby="education-center-title"><header><h1 id="education-center-title">Kenali modusnya.<br/>Ambil langkah yang tepat.</h1><p>Panduan singkat untuk membantu kamu berhenti sejenak, memeriksa konteks, dan menjaga informasi pribadi.</p><Link className="history-back" to={identity?'/dashboard#edukasi':'/#edukasi'}><ArrowLeft size={18} aria-hidden="true"/>Kembali ke beranda</Link></header><EducationState resource={resource}/><div className="education-index">{articles.map(article=><article key={article.slug}><img src={article.image} alt="" width={640} height={480} loading="lazy" decoding="async"/><div><p className="education-topic">{article.category}</p><h2><Link to={`/education/${article.slug}`}>{article.title}<ArrowUpRight size={20} aria-hidden="true"/></Link></h2><p>{article.description}</p></div></article>)}</div><p className="education-disclaimer">Materi ini adalah panduan umum, bukan hasil pemeriksaan kontenmu. Sumber rujukan tersedia pada setiap artikel.</p></section>
}

export function EducationArticlePage() {
  const {slug}=useParams()
  const resource=useEducation(slug)
  const related=useEducation()
  const articles=related.items
  const article=resource.items[0]
  if(resource.loading || resource.error)return <section className="education-page"><h1>Materi edukasi</h1><EducationState resource={resource}/></section>
  if(!article)return <section className="education-page"><h1>Artikel tidak ditemukan.</h1><p>Topik ini belum tersedia. Pilih salah satu bacaan di pusat edukasi.</p><Link className="button button-red" to="/education">Lihat semua topik</Link></section>
  return <article className="education-page education-reading"><Link to="/education" className="history-back"><ArrowLeft size={18} aria-hidden="true"/>Semua topik edukasi</Link><header><p className="education-topic">{article.category}</p><h1>{article.title}</h1><p>{article.description}</p></header><img className="education-reading-image" src={article.image} alt="" width={640} height={480} decoding="async"/>{article.sections.map(section=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}</section>)}<section className="education-source"><h2>Sumber dan batas panduan</h2><p>Ringkasan editorial AWASIN berdasarkan panduan publik berikut. Materi ini adalah panduan umum, bukan penilaian keamanan atas kontenmu.</p>{[article.source,...(article.sources??[])].map(source=><p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}<ArrowUpRight size={17} aria-hidden="true"/><span className="sr-only"> (buka situs sumber di tab baru)</span></a></p>)}</section><nav className="education-related" aria-label="Bacaan terkait"><h2>Lanjutkan membaca</h2>{articles.filter(item=>item.slug!==slug).map(item=><Link key={item.slug} to={`/education/${item.slug}`}>{item.title}<ArrowUpRight size={18} aria-hidden="true"/></Link>)}</nav><Link className="button button-red" to="/education">Kembali ke pusat edukasi</Link></article>
}

function EducationState({resource}:Readonly<{resource:ReturnType<typeof useEducation>}>) {
 return <>{resource.loading&&<output>Memuat materi edukasi…</output>}{!resource.loading&&!resource.error&&resource.items.length===0&&<p>Belum ada materi yang diterbitkan.</p>}{resource.error&&<div><p role="alert">{resource.error}</p><button type="button" className="button button-red" onClick={resource.reload}>Coba lagi</button></div>}{resource.previous&&<button type="button" className="button" onClick={resource.previous}>Halaman sebelumnya</button>}{resource.next&&<button type="button" className="button" onClick={resource.next}>Halaman berikutnya</button>}</>
}
