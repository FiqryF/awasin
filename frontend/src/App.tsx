import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes/AppRoutes'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './features/auth/AuthProvider'
import { PreferencesProvider } from './features/settings/PreferencesProvider'
import { AuthNotificationProvider } from './features/auth/AuthNotificationProvider'
import { AuthSessionGate } from './features/auth/AuthSessionGate'

export default function App() {
  return <MotionConfig reducedMotion="user"><BrowserRouter><AuthNotificationProvider><AuthProvider><AuthSessionGate><PreferencesProvider><AppRoutes /></PreferencesProvider></AuthSessionGate></AuthProvider></AuthNotificationProvider></BrowserRouter></MotionConfig>
}
