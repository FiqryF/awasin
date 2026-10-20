import { useState } from 'react'
import { ScanTypeSelector } from './ScanTypeSelector'
import { ScanForm } from './ScanForm'
import { scanTypes } from './scanConfig'
import type { ScanType } from './scanConfig'

export function ScanPanel() {
  const [selected, setSelected] = useState<ScanType>('link')
  const config = scanTypes.find(({ id }) => id === selected)!
  return <div className="scan-workspace"><p className="scan-selector-label">Pilih jenis pemeriksaan</p><ScanTypeSelector selected={selected} onSelect={setSelected} /><ScanForm key={selected} config={config} /></div>
}
