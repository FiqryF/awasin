import { useBlocker } from 'react-router'
import { SettingsDialog } from './SettingsDialog'

export function UnsavedChangesGuard({ dirty }: Readonly<{ dirty: boolean }>) {
  const blocker = useBlocker(dirty)
  return blocker.state === 'blocked' ? <SettingsDialog title="Tinggalkan perubahan?" confirmLabel="Ya, tinggalkan" onClose={() => blocker.reset()} onConfirm={() => blocker.proceed()}><p>Perubahan belum disimpan. Jika kamu meninggalkan halaman ini, perubahan tersebut akan hilang.</p></SettingsDialog> : null
}
