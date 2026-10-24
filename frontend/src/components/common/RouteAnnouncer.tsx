import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

export function RouteAnnouncer() {
  const { pathname, hash, key } = useLocation()
  const previousPath = useRef(pathname)
  const announcement=useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const changedPage = previousPath.current !== pathname
    previousPath.current = pathname
    let anchored=false
    let title=''
    function update(){
      const heading=document.querySelector<HTMLElement>('main h1')
      const next=(heading?.innerText??heading?.textContent??'Memuat halaman').replace(/\s+/g,' ').trim()
      if(next!==title){title=next;document.title=`${next} | AWASIN`;if(announcement.current)announcement.current.textContent=next}
      const target=hash?document.getElementById(hash.slice(1)):null
      if(target&&!anchored){
        anchored=true
        target.scrollIntoView({behavior:document.documentElement.dataset.accountMotion==='reduced'||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})
        const targetHeading=target.querySelector<HTMLElement>('h1,h2')
        targetHeading?.setAttribute('tabindex','-1');targetHeading?.focus({preventScroll:true})
      }
    }
    if(changedPage&&!hash){document.getElementById('main-content')?.focus();window.scrollTo(0,0)}
    update()
    const main=document.getElementById('main-content')
    const observer=new MutationObserver(update)
    if(main)observer.observe(main,{childList:true,subtree:true,characterData:true})
    return()=>observer.disconnect()
  }, [pathname, hash, key])

  return <p ref={announcement} className="sr-only" role="status" aria-live="polite" aria-atomic="true"/>
}
