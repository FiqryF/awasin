import { useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ScanTypeSelector } from './ScanTypeSelector'
import { ScanForm } from './ScanForm'
import { scanTypes } from './scanConfig'
import type { ScanType } from './scanConfig'

export function ScanPanel({ defaultMode = 'link', onHistorySaved }: Readonly<{ defaultMode?: ScanType; onHistorySaved?: () => void }>) {
  const [params,setParams]=useSearchParams()
  const { identity } = useAuth()
  const rawMode=params.get('mode')
  const requested=rawMode === 'website' ? 'link' : rawMode
  const config = scanTypes.find(({ id }) => id === requested) ?? scanTypes.find(({ id }) => id === defaultMode) ?? scanTypes[0]
  const selected = config.id
  const setSelected=(mode:ScanType)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('mode',mode);return next},{replace:true,preventScrollReset:true})
  return <div className="scan-workspace"><p className="scan-selector-label">Pilih jenis pemeriksaan</p><ScanTypeSelector selected={selected} onSelect={setSelected} /><ScanForm key={`${selected}:${identity?.id ?? 'guest'}`} config={config} ownerId={identity?.id} onHistorySaved={onHistorySaved} /></div>
}
