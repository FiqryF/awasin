import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

type ShinyTextProps = Readonly<{ children: ReactNode; className?: string; duration?: number }>

export function ShinyText({ children, className = '', duration = 3 }: ShinyTextProps) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <motion.span className={`shiny-text ${className}`}
      animate={{ backgroundPosition: reducedMotion ? '50% 50%' : ['150% 50%', '-150% 50%'] }}
      transition={reducedMotion ? { duration: 0 } : { duration: Math.max(1, duration), repeat: Infinity, ease: 'linear' }}
    >{children}</motion.span>
  )
}
