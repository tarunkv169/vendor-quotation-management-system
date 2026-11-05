import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// In development the browser calls same-origin "/api/..." and Vite forwards it to the API Gateway,
// so no CORS setup is needed locally. In production VITE_API_GATEWAY_URL is used instead (see apiClient.js).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:18080'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: gatewayTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
  }
})
