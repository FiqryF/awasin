import { useEffect, useState } from 'react'

export function useHistoryResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [snapshot, setSnapshot] = useState<{ key: string; data?: T; error?: Error }>({ key: '' })
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(data => { if (!controller.signal.aborted) setSnapshot({ key, data }) }).catch(error => {
      if (!controller.signal.aborted) setSnapshot({ key, error: error instanceof Error ? error : new Error('Permintaan gagal.') })
    })
    return () => controller.abort()
  },[key,load])
  return snapshot.key === key ? { ...snapshot, loading: false } : { key, data: undefined, error: undefined, loading: true }
}
