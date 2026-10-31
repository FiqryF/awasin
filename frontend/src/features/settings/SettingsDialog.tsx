import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function SettingsDialog({ title, children, onClose, onConfirm, confirmLabel }: Readonly<{ title: string; children: ReactNode; onClose: () => void; onConfirm: () => void; confirmLabel: string }>) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => { element.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return createPortal(<dialog ref={dialog} className="settings-confirm-dialog" aria-labelledby="settings-confirm-title" aria-describedby="settings-confirm-description" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 id="settings-confirm-title">{title}</h2><div id="settings-confirm-description">{children}</div>
    <div className="settings-dialog-actions"><button autoFocus type="button" className="button button-glass" onClick={onClose}>Batal</button><button type="button" className="button button-red" onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>, document.body)
}
