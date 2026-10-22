import { Link } from 'react-router'
import { motion } from 'motion/react'
import { BrandMark } from '../ui/BrandMark'
import { HomeBackLink } from '../ui/HomeBackLink'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { ReactNode } from 'react'

type AuthLayoutProps = {
  children: ReactNode
  /** Konten sisi kiri: headline, tagline, deskripsi singkat. */
  panelContent: ReactNode
  backTo?: string
  backLabel?: string
}

export function AuthLayout({ children, panelContent, backTo, backLabel }: Readonly<AuthLayoutProps>) {
  const reduced = usePrefersReducedMotion()

  return (
    <div className="auth-root">
      <div className="auth-atmosphere" aria-hidden="true">
        <span />
        <span />
      </div>
      <HomeBackLink className="auth-home-position" to={backTo} label={backLabel} />
      {/* Sisi kiri — identitas brand */}
      <motion.aside
        className="auth-panel-identity"
        initial={reduced ? false : { opacity: 0, x: -32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      >
        <div className="auth-identity-inner">
          <Link to="/" className="auth-brand" tabIndex={-1}>
            <BrandMark />
            <span className="wordmark">AWASIN.</span>
          </Link>
          {panelContent}
        </div>
      </motion.aside>

      {/* Sisi kanan — form */}
      <div className="auth-panel-form">
        {/* Header mini untuk mobile */}
        <div className="auth-form-header">
          <Link to="/" className="auth-brand">
            <BrandMark />
            <span className="wordmark">AWASIN.</span>
          </Link>
        </div>

        <motion.div
          className="auth-form-wrap"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>

      </div>
    </div>
  )
}
