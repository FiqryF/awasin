import { useCallback } from 'react'
import { ArrowUpRight, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { listHistory } from './api'
import { useHistoryResource } from './useHistoryResource'
import { HistoryList } from './HistoryList'
import './history.css'

export function RecentHistory({ revision = 0 }: Readonly<{ revision?: number }>) {
  const {identity}=useAuth()
  const load=useCallback((signal:AbortSignal)=>listHistory({search:'',mode:'',sort:'newest',limit:3},signal),[])
  const resource=useHistoryResource(`${identity?.id??'guest'}:${revision}`,load)
  return <section id="history" className="dashboard-activity section-space" data-nav-theme="dark" aria-labelledby="activity-title"><div className="page-width">
    <div className="dashboard-activity-heading"><div><h2 id="activity-title">Aktivitas Pemeriksaanmu</h2><p>Lihat pemeriksaan terbaru yang tersimpan di akunmu.</p></div><Link to="/history" className="button dashboard-history-action">Lihat Riwayat <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
    {resource.loading&&<output>Memuat aktivitas pemeriksaan…</output>}
    {resource.error&&<div className="dashboard-history-empty"><div><h3>Riwayat belum dapat dimuat.</h3><p>{resource.error.message}</p><Link to="/history" className="auth-link">Buka riwayat dan coba lagi</Link></div></div>}
    {resource.data&&(resource.data.items.length?<HistoryList items={resource.data.items}/>:<div className="dashboard-history-empty"><div><h3>Belum ada pemeriksaan tersimpan.</h3><p>Ringkasan pemeriksaan tautan muncul di sini jika penyimpanan aktif.</p><p className="dashboard-storage-note"><LockKeyhole size={15} aria-hidden="true"/>URL lengkap tidak disimpan.</p></div></div>)}
  </div></section>
}
