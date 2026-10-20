import { useRef } from 'react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { scanTypes } from './scanConfig'
import type { ScanType } from './scanConfig'

type Props = { selected: ScanType; onSelect: (type: ScanType) => void }

export function ScanTypeSelector({ selected, onSelect }: Props) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const reducedMotion = usePrefersReducedMotion()
  return (
    <div className="scan-tabs" role="tablist" aria-label="Jenis pemeriksaan">
      {scanTypes.map(({ id, label, icon: Icon }, index) => (
        <motion.button initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={reducedMotion ? { opacity: 1, y: 0 } : undefined} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : index * 0.06 }} key={id} ref={(element) => { tabs.current[index] = element }} type="button" role="tab" id={`tab-${id}`} aria-selected={selected === id}
          aria-controls={`panel-${id}`} tabIndex={selected === id ? 0 : -1} onClick={() => onSelect(id)}
          onKeyDown={(event) => {
            let next: number
            if (event.key === 'ArrowRight') next = (index + 1) % scanTypes.length
            else if (event.key === 'ArrowLeft') next = (index - 1 + scanTypes.length) % scanTypes.length
            else if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = scanTypes.length - 1
            else return
            event.preventDefault(); onSelect(scanTypes[next].id); tabs.current[next]?.focus()
          }}
        ><Icon size={19} aria-hidden="true" /><span>{label}</span></motion.button>
      ))}
    </div>
  )
}
