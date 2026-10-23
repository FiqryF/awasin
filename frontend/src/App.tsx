import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes/AppRoutes'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './features/auth/AuthProvider'

export default function App() {
  return <MotionConfig reducedMotion="user"><BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter></MotionConfig>
}
