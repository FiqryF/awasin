import { useCallback, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { History, Search, Trash2, ShieldCheck, Plus } from 'lucide-react'
import { useAuth } from '../features/auth/useAuth'
import { listHistory } from '../features/history/api'
import { useHistoryResource } from '../features/history/useHistoryResource'
import { DummyHistory } from '../features/history/DummyHistory'
import { HistoryList } from '../features/history/HistoryList'
import { DeleteHistoryDialog } from '../features/history/DeleteHistoryDialog'
import { modeLabels } from '../features/history/contracts'
import type { ScanMode } from '../features/history/contracts'
import '../features/history/history.css'

export function ScanHistoryPage() {
  const { identity }=useAuth()
  return identity?<HistoryContent key={identity.id} owner={identity.id}/>:null
}
function HistoryContent({owner}:Readonly<{owner:string}>) {
  const [searchInput,setSearchInput]=useState('')
  const [search,setSearch]=useState('')
  const [mode,setMode]=useState<ScanMode|''>('')
  const [sort,setSort]=useState<'newest'|'oldest'>('newest')
  const [cursors,setCursors]=useState<string[]>([])
  const [revision,setRevision]=useState(0)
  const [deletion,setDeletion]=useState<string|null>(null)
  const [notice,setNotice]=useState('')
  const cursor=cursors.at(-1)
  const load=useCallback((signal:AbortSignal)=>listHistory({search,mode,sort,cursor},signal),[search,mode,sort,cursor])
  const resource=useHistoryResource(`${owner}:${search}:${mode}:${sort}:${cursor??''}:${revision}`,load)
  function submit(event:SubmitEvent<HTMLFormElement>){event.preventDefault();setSearch(searchInput.trim());setCursors([]);setNotice('')}
  function reset(){setSearchInput('');setSearch('');setMode('');setSort('newest');setCursors([])}
  const filtered=Boolean(search||mode)
  return <section className="history-page" aria-labelledby="history-title">
    <div className="history-ambient" aria-hidden="true"/>
    <header className="history-page-heading"><div><span className="history-eyebrow"><History size={16} aria-hidden="true"/>JEJAK PEMERIKSAAN AWASIN</span><h1 id="history-title">Riwayat Pemeriksaanmu.</h1><p>Lihat kembali hasil pemeriksaan yang kamu pilih untuk disimpan.</p><p className="history-privacy-note"><ShieldCheck size={16} aria-hidden="true"/>Riwayat pribadi · Hanya laporan yang kamu pilih untuk disimpan.</p></div><Link to="/dashboard#periksa" className="button button-red"><Plus size={18} aria-hidden="true"/>Pemeriksaan baru</Link></header>
    <form className="history-filters" onSubmit={submit} aria-label="Cari dan saring riwayat">
      <div className="history-search"><label htmlFor="history-search">Cari ringkasan aman</label><div><input id="history-search" value={searchInput} maxLength={80} pattern="[\p{L}\p{N}_ .\-]*" placeholder="Cari judul pemeriksaan" onChange={e=>setSearchInput(e.target.value)}/><button className="icon-button" type="submit" aria-label="Cari riwayat"><Search size={19} aria-hidden="true"/></button></div></div>
      <div><label htmlFor="history-mode">Jenis pemeriksaan</label><select id="history-mode" value={mode} onChange={e=>{setMode(e.target.value as ScanMode|'');setCursors([])}}><option value="">Semua jenis</option>{Object.entries(modeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
      <div><label htmlFor="history-sort">Urutkan tanggal</label><select id="history-sort" value={sort} onChange={e=>{setSort(e.target.value as 'newest'|'oldest');setCursors([])}}><option value="newest">Terbaru dahulu</option><option value="oldest">Terlama dahulu</option></select></div>
    </form>
    {import.meta.env.DEV&&!cursor&&<DummyHistory search={search} mode={mode} sort={sort}/>}
    {notice&&<output className="history-notice">{notice}</output>}
    {resource.loading&&<output className="history-loading">Memuat riwayat pemeriksaan…</output>}
    {resource.error&&<div className="history-state" role="alert"><h2>Riwayat belum dapat dimuat.</h2><p>{resource.error.message}</p><button type="button" className="button button-red" onClick={()=>setRevision(r=>r+1)}>Coba lagi</button><Link className="auth-link" to="/login" state={{returnTo:'/history'}}>Masuk kembali</Link></div>}
    {resource.data&&<>
      {resource.data.items.length>0?<><div className="history-list-toolbar"><p>Halaman {cursors.length+1}</p><button type="button" className="history-text-action" onClick={()=>setDeletion('all')}><Trash2 size={16} aria-hidden="true"/>Hapus seluruh riwayat</button></div><HistoryList items={resource.data.items} onDelete={setDeletion}/></>:<div className="history-state"><History size={32} strokeWidth={1.4} aria-hidden="true"/><h2>{filtered?'Tidak ada riwayat yang cocok.':'Belum ada pemeriksaan tersimpan.'}</h2><p>{filtered?'Coba gunakan kata kunci atau filter yang berbeda.':'Hasil pemeriksaan yang kamu pilih untuk disimpan akan muncul di sini.'}</p>{filtered?<button type="button" className="button history-secondary" onClick={reset}>Reset filter</button>:<Link className="button button-red" to="/dashboard#periksa">Mulai Periksa</Link>}</div>}
      {(cursor||resource.data.next_cursor)&&<nav className="history-pagination" aria-label="Halaman riwayat"><button type="button" className="button history-secondary" disabled={!cursor} onClick={()=>setCursors(c=>c.slice(0,-1))}>Sebelumnya</button><button type="button" className="button history-secondary" disabled={!resource.data.next_cursor} onClick={()=>{const next=resource.data?.next_cursor;if(next)setCursors(c=>[...c,next])}}>Berikutnya</button></nav>}
    </>}
    {deletion&&<DeleteHistoryDialog id={deletion==='all'?undefined:deletion} onClose={()=>setDeletion(null)} onDeleted={count=>{setDeletion(null);setCursors([]);setRevision(r=>r+1);setNotice(`${count} laporan berhasil dihapus.`)}}/>}
  </section>
}
