import { HistoryModeIcon } from './HistoryModeIcon'
import { modeLabels, type ScanMode } from './contracts'

const examples = [
  { id: 'demo-link', mode: 'link' as const, title: 'Contoh pemeriksaan tautan promosi', date: '2026-10-31T09:00:00+07:00', dateLabel: '31 Okt 2026, 09.00 WIB', riskLevel: 'high', risk: 'Risiko tinggi · simulasi' },
  { id: 'demo-message', mode: 'message' as const, title: 'Contoh pemeriksaan pesan hadiah', date: '2026-10-30T14:30:00+07:00', dateLabel: '30 Okt 2026, 14.30 WIB', riskLevel: 'low', risk: 'Risiko rendah · simulasi' },
]

export function DummyHistory({ search, mode, sort }: Readonly<{ search: string; mode: ScanMode | ''; sort: 'newest' | 'oldest' }>) {
  const items = examples.filter(item => (!mode || item.mode === mode) && item.title.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))).sort((a,b) => sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
  if (!items.length) return null
  return <section className="history-dummy" aria-labelledby="history-dummy-title">
    <div className="history-dummy-heading"><h2 id="history-dummy-title">Contoh riwayat pemeriksaan</h2><span>Data dummy</span></div>
    <p>Pratinjau tampilan di mode pengembangan. Status dan risiko di bawah adalah simulasi, bukan hasil analisis. Contoh ini tidak disimpan ke akun.</p>
    <ul className="history-list">{items.map(item => <li key={item.id}><HistoryModeIcon mode={item.mode}/><div className="history-card-body">
      <div className="history-item-meta"><span className="history-mode-label">{modeLabels[item.mode]} · Data dummy</span><time dateTime={item.date}>{item.dateLabel}</time></div>
      <div className="history-item-main"><h3>{item.title}</h3><div className="history-item-status"><span className="history-status-badge" data-status="completed">Simulasi selesai</span><span className="history-risk-badge" data-risk={item.riskLevel}>{item.risk}</span></div></div>
    </div></li>)}</ul>
  </section>
}
