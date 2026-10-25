import { createContext, useContext } from 'react'

export type AuthNotification = Readonly<{
  title: string
  message: string
  tone: 'success' | 'warning' | 'error'
}>
export const AuthNotificationContext = createContext<{
  notify: (notice: AuthNotification) => void
  signingOut: boolean
  beginLogout: () => boolean
  finishLogout: () => void
  goToPublicHome: () => void | Promise<void>
}>({ notify: () => {}, signingOut: false, beginLogout: () => true, finishLogout: () => {}, goToPublicHome: () => {} })
export const useAuthNotifications = () => useContext(AuthNotificationContext)
