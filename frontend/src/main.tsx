import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { resetHomeOnReload } from './utils/resetHomeOnReload'

resetHomeOnReload()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
