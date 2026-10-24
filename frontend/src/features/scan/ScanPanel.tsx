import { useSearchParams } from 'react-router'
import { ScanTypeSelector } from './ScanTypeSelector'
import { ScanForm } from './ScanForm'
import { scanTypes } from './scanConfig'
import type { ScanType } from './scanConfig'

export function ScanPanel({ defaultMode = 'link' }: Readonly<{ defaultMode?: ScanType }>) {
  const [params,setParams]=useSearchParams()
  const requested=params.get('mode')
  const selected=scanTypes.find(type=>type.id===requested)?.id??defaultMode
  const setSelected=(mode:ScanType)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('mode',mode);return next},{replace:true,preventScrollReset:true})
  const config = scanTypes.find(({ id }) => id === selected)!
  return <div className="scan-workspace"><p className="scan-selector-label">Pilih jenis pemeriksaan</p><ScanTypeSelector selected={selected} onSelect={setSelected} /><ScanForm key={selected} config={config} /></div>
}
