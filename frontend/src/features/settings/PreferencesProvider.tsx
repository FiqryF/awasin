import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { useAuth } from '../auth/useAuth'
import { getPreferences, savePreferences, type Preferences } from './api'
import { PreferencesContext } from './context'
import { useHistoryResource } from '../history/useHistoryResource'

export function PreferencesProvider({children}:Readonly<{children:ReactNode}>) {
  const {identity}=useAuth()
  return <AccountPreferences key={identity?.id??'guest'} owner={identity?.id}>{children}</AccountPreferences>
}
function AccountPreferences({owner,children}:Readonly<{owner?:string;children:ReactNode}>) {
  const [revision,setRevision]=useState(0)
  const [saved,setSaved]=useState<Preferences|null>(null)
  const saving=useRef(false)
  const load=useCallback(async(signal:AbortSignal)=>owner?getPreferences(signal,owner):null,[owner])
  const resource=useHistoryResource(`${owner??'guest'}:${revision}`,load)
  const value=saved??resource.data??null
  useEffect(()=>{
    document.documentElement.dataset.accountMotion=value?.animation??'system'
    window.dispatchEvent(new Event('awasin-motion-change'))
    return ()=>{delete document.documentElement.dataset.accountMotion;window.dispatchEvent(new Event('awasin-motion-change'))}
  },[value?.animation])
  const update = useCallback(async(next:Preferences)=>{
    if(saving.current)throw new Error('Perubahan sebelumnya masih disimpan. Tunggu sebentar lalu coba lagi.')
    saving.current=true
    try{const result=await savePreferences(next,owner);setSaved(result)}finally{saving.current=false}
  }, [owner])
  const reload = useCallback(()=>setRevision(r=>r+1), [])
  const error = resource.error?.message ?? ''
  const context = useMemo(()=>({value,error,update,reload}), [value,error,update,reload])
  return <PreferencesContext.Provider value={context}><MotionConfig reducedMotion={value?.animation==='reduced'?'always':'user'}>{children}</MotionConfig></PreferencesContext.Provider>
}
