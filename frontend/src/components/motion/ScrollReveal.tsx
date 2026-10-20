import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { ReactNode } from 'react'

type ScrollRevealProps = Readonly<{ children: ReactNode; className?: string; delay?: number }>

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <motion.div className={className} initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      animate={reducedMotion ? { opacity: 1, y: 0 } : undefined}
      whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >{children}</motion.div>
  )
}
