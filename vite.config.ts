import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Use root base by default; if you need a subpath, set VITE_BASE_PATH in environment and use that during build
  base: '/',
  server: {
    port: 3000,
  },
  plugins: [react()],
})
