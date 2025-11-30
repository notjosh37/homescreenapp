import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/notion': {
        target: 'https://api.notion.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Notion-Version', '2022-06-28')
            // Also support newer API version if needed
            // proxyReq.setHeader('Notion-Version', '2024-05-15')
          })
        }
      }
    }
  }
})
