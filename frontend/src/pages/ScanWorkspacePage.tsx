import { Link } from 'react-router'
import { ScanPanel } from '../features/scan/ScanPanel'
import { ScanSidebar } from '../features/scan/ScanSidebar'
import type { ScanType } from '../features/scan/scanConfig'
import { useAuth } from '../features/auth/useAuth'

export function ScanWorkspacePage({mode}:Readonly<{mode:ScanType}>) {
  const {identity}=useAuth()
  return <section className="standalone-scan" aria-labelledby="workspace-title"><header className="section-heading"><Link to={identity?'/dashboard#periksa':'/#periksa'} className="auth-link">Kembali ke beranda</Link><h1 id="workspace-title" className="history-workspace-title">Periksa konten mencurigakan.</h1><p>Pilih jenis konten. Validasi input dan pembacaan QR bukan hasil analisis keamanan.</p></header><div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-12"><div className="min-w-0 lg:col-span-8"><ScanPanel defaultMode={mode}/></div><div className="min-w-0 lg:col-span-4"><ScanSidebar/></div></div></section>
}
