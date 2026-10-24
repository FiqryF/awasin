import { useState } from 'react'
import { saveReport } from './api'
import type { ReportDetail } from './contracts'
import { Link } from 'react-router'
import { usePreferences } from '../settings/context'

export function SaveReportAction({report,onSaved}:Readonly<{report:ReportDetail;onSaved:()=>void}>) {
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const {value:preferences}=usePreferences()
  if(report.status!=='completed'||report.saved_at!==null)return null
  if(preferences?.history_retention==='disabled')return <p className="history-notice">Penyimpanan laporan baru dinonaktifkan. <Link className="auth-link" to="/settings?section=privacy">Atur Privasi &amp; Data</Link></p>
  async function save(){
    if(busy||!consent)return
    setBusy(true);setError('')
    try{await saveReport(report.id,consent);onSaved()}
    catch(error){setError(error instanceof Error?error.message:'Laporan belum dapat disimpan.')}
    finally{setBusy(false)}
  }
  return <section className="report-save" aria-labelledby="report-save-title"><h2 id="report-save-title">Simpan hasil ini?</h2><p>Hanya ringkasan aman dan hasil analisis terstruktur yang disimpan di akunmu. Pesan asli, URL dengan parameter pribadi, screenshot, dan media tidak disertakan.</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Saya memilih menyimpan hasil pemeriksaan ini ke riwayat pribadi.</label>{error&&<p role="alert">{error}</p>}<button className="button button-red" disabled={!consent||busy} onClick={()=>void save()}>{busy?'Menyimpan…':'Simpan ke Riwayat'}</button></section>
}
