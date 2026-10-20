import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

export function RouteAnnouncer() {
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)

  useEffect(() => {
    const heading = document.querySelector('h1')
    document.title = `${heading?.textContent ?? 'Halaman'} | AWASIN`
    if (previousPath.current !== pathname) {
      document.getElementById('main-content')?.focus()
      window.scrollTo(0, 0)
      previousPath.current = pathname
    }
  }, [pathname])

  return null
}
