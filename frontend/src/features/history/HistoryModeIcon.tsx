import { Link2, MessageSquareText, Globe, QrCode, Image, Video } from 'lucide-react'
import type { ScanMode } from './contracts'
const icons = { link: Link2, message: MessageSquareText, website: Globe, qr: QrCode, image: Image, video: Video }
export function HistoryModeIcon({ mode }: Readonly<{ mode: ScanMode }>) {
  const Icon = icons[mode]
  return <span className="history-mode-icon" aria-hidden="true"><Icon size={23}/></span>
}
