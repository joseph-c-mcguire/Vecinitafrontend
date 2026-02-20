import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const gatewayProxyTarget =
  process.env.VITE_GATEWAY_PROXY_TARGET || 'http://127.0.0.1:8004'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy API requests to the backend gateway during development
      '/api': {
        target: gatewayProxyTarget,
        changeOrigin: true,
        rewrite: (path) =>
          path.startsWith('/api/v1/') ? path : path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
})
