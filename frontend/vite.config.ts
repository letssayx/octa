import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // Avoid WSL default conflicts
    strictPort: true, // Fail if port is in use rather than jumping to random port
  }
})
