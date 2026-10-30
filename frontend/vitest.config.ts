import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', env: { VITE_EDUCATION_SOURCE: 'local' }, include: ['tests/**/*.test.{ts,tsx}'], restoreMocks: true, clearMocks: true },
})
