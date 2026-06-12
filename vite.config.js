import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    hmr: {
      protocol: 'wss',
      clientPort: 443
    }
  },
  define: {
    'import.meta.env.VITE_API_KEY': JSON.stringify(process.env.VITE_API_KEY || ''),
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://trifield-ai.up.railway.app')
  }
})
