import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

export function RouteAnnouncer() {
  const { pathname, hash, key } = useLocation()
  const previousPath = useRef(pathname)

  useEffect(() => {
    const heading = document.querySelector('h1')
    document.title = `${heading?.textContent ?? 'Halaman'} | AWASIN`
    const changedPage = previousPath.current !== pathname
    previousPath.current = pathname
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      const heading = target.querySelector<HTMLElement>('h1, h2')
      heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true })
    } else if (changedPage) {
      document.getElementById('main-content')?.focus(); window.scrollTo(0, 0)
    }
  }, [pathname, hash, key])

  return null
}
