import { ArrowUpRight, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { modeLabels, riskLabels, statusLabels } from './contracts'
import type { HistorySummary } from './contracts'
import { HistoryModeIcon } from './HistoryModeIcon'
import { formatReportDate } from './formatReportDate'

export function HistoryList({ items, onDelete }: Readonly<{ items: HistorySummary[]; onDelete?: (id: string) => void }>) {
  return <ul className="history-list">{items.map(item=><li key={item.id}><HistoryModeIcon mode={item.mode}/><div className="history-card-body">
    <div className="history-item-meta"><span className="history-mode-label">{modeLabels[item.mode]}</span><time dateTime={item.created_at}>{formatReportDate(item.created_at)}</time></div>
    <div className="history-item-main"><Link to={`/history/${item.id}`}><h2>{item.safe_label}</h2><ArrowUpRight size={19} aria-hidden="true"/></Link><div className="history-item-status"><span className="history-status-badge" data-status={item.status}>{statusLabels[item.status]}</span>{item.status==='completed'&&item.risk&&<span className="history-risk-badge" data-risk={item.risk}>{riskLabels[item.risk]}</span>}</div></div>
    </div>{onDelete&&<button type="button" className="icon-button" onClick={()=>onDelete(item.id)} aria-label={`Hapus ${item.safe_label}`}><Trash2 size={18} aria-hidden="true"/></button>}
  </li>)}</ul>
}
