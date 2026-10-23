import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (key && !key.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key, never an administrative secret, in frontend configuration.')
  const api = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL
  if (command === 'build' && key && (!api || new URL(api).protocol !== 'https:')) throw new Error('Configured production authentication requires an explicit HTTPS API URL.')
  return { plugins: [react(), tailwindcss()] }
})
