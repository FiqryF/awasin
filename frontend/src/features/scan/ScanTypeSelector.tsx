import { useId, useRef } from 'react'
import { LayoutGroup, motion } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { scanTypes } from './scanConfig'
import type { ScanType } from './scanConfig'

type Props = Readonly<{ selected: ScanType; onSelect: (type: ScanType) => void }>

export function ScanTypeSelector({ selected, onSelect }: Props) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const groupId = useId()
  const reducedMotion = usePrefersReducedMotion()
  return (
    <LayoutGroup id={groupId}><div className="scan-tabs" role="tablist" aria-label="Jenis pemeriksaan">
      {scanTypes.map(({ id, label, icon: Icon }, index) => (
        <motion.button whileTap={reducedMotion ? undefined : { scale: 0.97 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} key={id} ref={(element) => { tabs.current[index] = element }} type="button" role="tab" id={`tab-${id}`} aria-selected={selected === id}
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
        >
          {selected === id && <motion.span className="scan-tab-surface" layoutId="selected-scan-type" initial={false} transition={{ duration: reducedMotion ? 0 : 0.38, ease: [0.16, 1, 0.3, 1] }} aria-hidden="true" />}
          <motion.span className="scan-tab-icon" initial={false} animate={{ scale: selected === id ? 1.06 : 1 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></motion.span>
          <span className="scan-tab-label">{label}</span><span className="scan-tab-dot" aria-hidden="true" />
        </motion.button>
      ))}
    </div></LayoutGroup>
  )
}
