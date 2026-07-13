import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:8000', changeOrigin: true },
      '/tasks': { target: 'http://localhost:8000', changeOrigin: true },
      '/teams': { target: 'http://localhost:8000', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:8000', changeOrigin: true },
      '/notifications': { target: 'http://localhost:8000', changeOrigin: true },
      '/assignments': { target: 'http://localhost:8000', changeOrigin: true },
      '/activity':    { target: 'http://localhost:8000', changeOrigin: true },
      '/zammad':      { target: 'http://localhost:8000', changeOrigin: true },
      '/banks':       { target: 'http://localhost:8000', changeOrigin: true },
      '/attachments': { target: 'http://localhost:8000', changeOrigin: true },
      '/deployments': { target: 'http://localhost:8000', changeOrigin: true },
      '/health':      { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
