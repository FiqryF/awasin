import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { deleteHistory } from './api'
import { useAuth } from '../auth/useAuth'

export function DeleteHistoryDialog({ id, onClose, onDeleted }: Readonly<{ id?: string; onClose: () => void; onDeleted: (count: number) => void }>) {
  const {identity}=useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  useEffect(()=>{
    const element=dialog.current!
    const previousFocus=document.activeElement
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    element.showModal()
    return ()=>{element.close();document.body.style.overflow=overflow;queueMicrotask(()=>{if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus({preventScroll:true})})}
  },[])
  async function remove() {
    if(busy)return
    setBusy(true);setError('')
    try { onDeleted(await deleteHistory(id,identity?.id)) }
    catch(error){setError(error instanceof Error?error.message:'Penghapusan gagal. Coba lagi.');setBusy(false)}
  }
  return createPortal(<dialog ref={dialog} className="history-delete-dialog" aria-labelledby="delete-history-title" aria-describedby="delete-history-description" onCancel={event=>{event.preventDefault();if(!busy)onClose()}}>
    <button type="button" className="icon-button history-dialog-close" aria-label="Tutup konfirmasi" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true"/></button>
    <h2 id="delete-history-title">{id?'Hapus pemeriksaan ini?':'Hapus seluruh riwayatmu?'}</h2>
    <p id="delete-history-description">{id?'Laporan ini akan dihapus permanen dari akunmu.':'Seluruh laporan tersimpan milik akunmu akan dihapus permanen, termasuk yang tidak tampil karena filter.'} Tindakan ini tidak dapat dibatalkan.</p>
    {error&&<p role="alert" className="history-error">{error}</p>}
    <div className="history-dialog-actions"><button type="button" className="button history-secondary" disabled={busy} onClick={onClose}>Batal</button><button type="button" className="button button-red" disabled={busy} onClick={()=>void remove()}>{busy?'Menghapus…':'Ya, hapus permanen'}</button></div>
  </dialog>,document.body)
}
