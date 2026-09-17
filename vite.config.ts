import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { ledgerApiPlugin } from './vite-plugin-ledger.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), ledgerApiPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 8787,
  },
})
