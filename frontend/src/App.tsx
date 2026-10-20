import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes/AppRoutes'
import { MotionConfig } from 'motion/react'

export default function App() {
  return <MotionConfig reducedMotion="user"><BrowserRouter><AppRoutes /></BrowserRouter></MotionConfig>
}
