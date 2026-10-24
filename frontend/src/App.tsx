import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes/AppRoutes'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './features/auth/AuthProvider'
import { PreferencesProvider } from './features/settings/PreferencesProvider'

export default function App() {
  return <MotionConfig reducedMotion="user"><BrowserRouter><AuthProvider><PreferencesProvider><AppRoutes /></PreferencesProvider></AuthProvider></BrowserRouter></MotionConfig>
}
