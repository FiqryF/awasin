import { useCallback } from 'react'
import { createAuthActions } from './actions'
import { requireSupabase } from './client'
import { useAuth } from './useAuth'
import { useAuthNotifications } from './authNotifications'
import { clearSessionNotice, getSessionNotice } from './sessionActivity'

export function useLogout() {
  const { refresh } = useAuth()
  const { notify, beginLogout, finishLogout, goToPublicHome } = useAuthNotifications()
  return useCallback(async () => {
    if (!beginLogout()) return
    let returningHome = false
    try {
      clearSessionNotice()
      const client = requireSupabase()
      await createAuthActions(client, window.location.origin).logout()
      const remaining = await client.auth.getSession()
      if (remaining.error || remaining.data.session || await refresh()) throw new Error('Sesi masih aktif atau belum dapat dikonfirmasi ditutup. Coba keluar kembali.')
      const warning = getSessionNotice()
      notify({ title: 'Anda sudah keluar', message: warning || 'Sesi pada browser ini telah ditutup. Anda kembali ke beranda AWASIN.', tone: warning ? 'warning' : 'success' })
      // This must finish even if SIGNED_OUT unmounts the button's page first.
      await goToPublicHome()
      returningHome = true
    } catch (error) {
      notify({ title: 'Logout belum terkonfirmasi', message: error instanceof Error ? error.message : 'Periksa koneksi dan coba keluar kembali.', tone: 'error' })
      throw error
    } finally { if (!returningHome) finishLogout() }
  }, [refresh, notify, beginLogout, finishLogout, goToPublicHome])
}
