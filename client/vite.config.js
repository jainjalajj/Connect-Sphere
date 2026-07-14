import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split TF.js into its own chunk so the main bundle stays small
        manualChunks: {
          tfjs: [
            '@tensorflow/tfjs-core',
            '@tensorflow/tfjs-backend-webgl',
            '@tensorflow/tfjs-converter',
            '@tensorflow-models/body-segmentation',
          ],
        },
      },
    },
  },
})
