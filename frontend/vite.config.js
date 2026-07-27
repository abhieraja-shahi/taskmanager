import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const spaBypass = (req) => {
  if (req.headers.accept?.includes('text/html')) return '/index.html'
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':          { target: 'http://localhost:8000', changeOrigin: true },
      '/tasks':         { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/teams':         { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/dashboard':     { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/notifications': { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/assignments':   { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/activity':      { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/zammad':        { target: 'http://localhost:8000', changeOrigin: true },
      '/banks':         { target: 'http://localhost:8000', changeOrigin: true },
      '/attachments':   { target: 'http://localhost:8000', changeOrigin: true },
      '/deployments':   { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/health':        { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
