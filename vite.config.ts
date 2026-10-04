import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // preserveDrawingBuffer is set on the Canvas directly — no vite config needed
})
