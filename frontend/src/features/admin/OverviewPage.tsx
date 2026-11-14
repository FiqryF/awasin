import { Link } from 'react-router'
import { ArrowUpRight, BookOpen, MessageSquare } from 'lucide-react'
import { useAdminData, type Overview } from './api'
import { PageHead, State } from './ui'

type DetectionQuality = { too_safe: number; too_risky: number; unreviewed: number; since: string }

export function OverviewPage() {
  const stats = useAdminData<Overview>('overview')
  const quality = useAdminData<DetectionQuality>('detection-quality')
  return <>
    <PageHead title="Kendali yang terukur." description="Tinjau masukan dan kelola konten edukasi AWASIN." />
    <State error={stats.error} loading={!stats.data} retry={stats.reload} />
    {stats.data && <div className="admin-overview-grid">
      <section className="admin-brief" aria-labelledby="admin-feedback-title">
        <div>
          <h2 id="admin-feedback-title"><MessageSquare size={18} aria-hidden="true" /> Antrean feedback</h2>
          <strong>{stats.data.feedback_new}</strong>
          <p>Masukan menunggu tinjauan</p>
          <Link to="/admin/feedback?status=new">Buka antrean <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <dl>
          <div><dt>Seluruh masukan</dt><dd>{stats.data.feedback_total}</dd></div>
          <div><dt>Dalam tinjauan</dt><dd>{stats.data.feedback_in_review}</dd></div>
          <div><dt>Selesai</dt><dd>{stats.data.feedback_resolved}</dd></div>
        </dl>
      </section>
      <Link className="admin-education-overview" to="/admin/articles">
        <span><BookOpen size={18} aria-hidden="true" /> Konten edukasi <ArrowUpRight size={16} aria-hidden="true" /></span>
        <strong>{stats.data.articles_published} <small>artikel terbit</small></strong>
        <p>Tersedia di halaman Edukasi.</p>
      </Link>
    </div>}
    <section className="admin-editor admin-quality" aria-labelledby="quality-title">
      <h2 id="quality-title">Kualitas Deteksi</h2>
      <p>Laporan pengguna dalam 30 hari terakhir.</p>
      <State error={quality.error} loading={!quality.data} retry={quality.reload} />
      {quality.data && <QualityChart data={quality.data} />}
    </section>
  </>
}

function QualityChart({ data }: Readonly<{ data: DetectionQuality }>) {
  const total = data.too_safe + data.too_risky
  const safePercent = total ? 100 * data.too_safe / total : 0
  const background = total ? `conic-gradient(#f58b86 ${safePercent}%, #efc16f 0)` : undefined
  const reports = `/admin/feedback?category=detection&since=${data.since.slice(0, 10)}`
  return <div className="admin-quality-chart">
    <div className="admin-quality-ring" style={{ background }} aria-hidden="true"><span>{total}</span></div>
    <div>
      <p className="admin-footnote">Perbandingan laporan terlalu aman dan terlalu berisiko.</p>
      <ul aria-label="Rincian kategori pada grafik">
        <li><Link to={`${reports}&search=${encodeURIComponent('Konten berisiko dinilai aman')}`}><i aria-hidden="true" />Dinilai terlalu aman <strong>{data.too_safe}</strong></Link></li>
        <li><Link to={`${reports}&search=${encodeURIComponent('Konten aman dinilai berisiko')}`}><i aria-hidden="true" />Dinilai terlalu berisiko <strong>{data.too_risky}</strong></Link></li>
      </ul>
      <Link className="admin-quality-pending" to={`${reports}&status=new`}>Belum ditinjau <strong>{data.unreviewed}</strong><ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
  </div>
}
