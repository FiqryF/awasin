import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppRoutes } from './routes/AppRoutes'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './features/auth/AuthProvider'
import { PreferencesProvider } from './features/settings/PreferencesProvider'
import { AuthNotificationProvider } from './features/auth/AuthNotificationProvider'
import { AuthSessionGate } from './features/auth/AuthSessionGate'

const router = createBrowserRouter([{ path: '*', element: <AuthNotificationProvider><AuthProvider><AuthSessionGate><PreferencesProvider><AppRoutes /></PreferencesProvider></AuthSessionGate></AuthProvider></AuthNotificationProvider> }])

export default function App() {
  return <MotionConfig reducedMotion="user"><RouterProvider router={router} /></MotionConfig>
}
