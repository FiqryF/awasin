import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowUpRight, Trash2 } from 'lucide-react'
import { useAuth } from '../features/auth/useAuth'
import { getReport, HistoryError } from '../features/history/api'
import { useHistoryResource } from '../features/history/useHistoryResource'
import { DeleteHistoryDialog } from '../features/history/DeleteHistoryDialog'
import { modeLabels, riskLabels, statusLabels } from '../features/history/contracts'
import { formatReportDate } from '../features/history/formatReportDate'
import '../features/history/history.css'
import { SaveReportAction } from '../features/history/SaveReportAction'
import { articleForMode } from '../features/education/articles'
import { keyedItems } from '../features/history/keyedItems'

export function AnalysisDetailPage() {
  const {identity}=useAuth(),{id=''}=useParams()
  return identity?<DetailContent key={`${identity.id}:${id}`} owner={identity.id} id={id}/>:null
}
function DetailContent({owner,id}:Readonly<{owner:string;id:string}>) {
  const [revision,setRevision]=useState(0),[deleting,setDeleting]=useState(false)
  const [params]=useSearchParams()
  const preview=params.get('preview')==='true'
  const navigate=useNavigate()
  const load=useCallback((signal:AbortSignal)=>getReport(id,signal,preview),[id,preview])
  const {data:report,loading,error}=useHistoryResource(`${owner}:${id}:${preview}:${revision}`,load)
  const missing=error instanceof HistoryError&&[403,404].includes(error.status)
  const reading=report?articleForMode(report.mode):null
  const canReference=report?.status==='completed'&&Boolean(report.saved_at)
  return <article className="history-page report-page" aria-labelledby="report-title">
    <Link to="/history" className="history-back"><ArrowLeft size={18} aria-hidden="true"/>Kembali ke Riwayat</Link>
    <header className="history-page-heading"><h1 id="report-title">Detail Hasil Pemeriksaan</h1><p>Informasi laporan milik akunmu, berdasarkan hasil yang diberikan oleh layanan analisis.</p></header>
    {loading&&<output className="history-loading">Memuat laporan…</output>}
    {error&&<div className="history-state" role="alert"><h2>{missing?'Laporan tidak ditemukan.':'Laporan belum dapat dimuat.'}</h2><p>{error.message}</p>{!missing&&<button type="button" className="button button-red" onClick={()=>setRevision(r=>r+1)}>Coba lagi</button>}</div>}
    {report&&<>
      <section className="report-overview" aria-labelledby="report-overview-title"><h2 id="report-overview-title">Ringkasan Pemeriksaan</h2><p className="report-safe-label">{report.safe_label}</p><dl><div><dt>Jenis konten</dt><dd>{modeLabels[report.mode]}</dd></div><div><dt>Tanggal pemeriksaan</dt><dd><time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time></dd></div><div><dt>Status analisis</dt><dd>{statusLabels[report.status]}</dd></div><div><dt>Referensi laporan</dt><dd className="report-reference">{report.id}</dd></div></dl></section>
      {report.status==='completed'&&report.risk&&<section className="report-section"><h2>Indikasi Risiko</h2><p className="report-risk">{riskLabels[report.risk]}</p><p>Hasil ini merupakan indikasi, bukan jaminan keamanan atau bukti final pelanggaran. Selalu verifikasi melalui kanal resmi.</p></section>}
      {report.status!=='completed'&&<output className="history-notice">{report.status==='unsupported'?'Analisis untuk jenis konten ini belum tersedia.':statusLabels[report.status]} Laporan ini belum merupakan hasil pemeriksaan yang selesai.</output>}
      {report.result.findings.length>0&&<section className="report-section"><h2>Bukti dan Temuan</h2>{keyedItems(report.result.findings).map(({key,value:finding})=><div className="report-finding" key={key}><h3>{finding.title}</h3><p>{finding.description}</p></div>)}</section>}
      {(report.engine||report.result.sources.length>0||report.result.checks.length>0)&&<section className="report-section"><h2>Sumber dan Transparansi</h2>{report.engine&&<p>Engine: {report.engine}{report.engine_version?` · versi ${report.engine_version}`:''}{report.analyzed_at?` · dianalisis ${formatReportDate(report.analyzed_at)}`:''}</p>}{report.result.sources.length>0&&<ul>{keyedItems(report.result.sources).map(({key,value:source})=><li key={key}><strong>{source.name}</strong>{source.reference&&<span> — {source.reference}</span>}</li>)}</ul>}{report.result.checks.length>0&&<dl className="report-checks">{keyedItems(report.result.checks).map(({key,value:check})=><div key={key}><dt>{check.name}</dt><dd>{({completed:'Dilakukan',failed:'Gagal diperiksa',not_performed:'Tidak dilakukan',unsupported:'Tidak didukung'})[check.status]}{check.detail&&<p>{check.detail}</p>}</dd></div>)}</dl>}</section>}
      {report.result.recommendations.length>0&&<section className="report-section"><h2>Langkah yang Disarankan</h2><ul>{keyedItems(report.result.recommendations).map(({key,value:item})=><li key={key}>{item}</li>)}</ul></section>}
      {reading&&<section className="report-section"><h2>Panduan terkait jenis konten</h2><p>Bacaan umum berdasarkan jenis pemeriksaan, bukan temuan atau penilaian tambahan atas laporan ini.</p><Link className="auth-link" to={`/education/${reading.slug}`}>{reading.title}</Link></section>}
      <SaveReportAction report={report} onSaved={()=>setRevision(r=>r+1)}/>
      <div className="report-actions"><Link className="button button-red" to={`/dashboard?mode=${report.mode}#periksa`}>Periksa Lagi <ArrowUpRight size={18} aria-hidden="true"/></Link><Link className="button history-secondary" to="/feedback" state={{feedbackCategory:'detection',...(canReference?{scanReference:report.id}:{})}}>{canReference?'Laporkan Hasil Ini':'Kirim masukan'}</Link>{report.saved_at&&<button type="button" className="history-text-action" onClick={()=>setDeleting(true)}><Trash2 size={17} aria-hidden="true"/>Hapus dari Riwayat</button>}</div>
    </>}
    {deleting&&<DeleteHistoryDialog id={id} onClose={()=>setDeleting(false)} onDeleted={()=>{void navigate('/history',{replace:true})}}/>}
  </article>
}
