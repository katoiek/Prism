import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: './', // Important for Electron to load assets with relative paths
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-ag-grid': ['ag-grid-community', 'ag-grid-react'],
          'vendor-xlsx': ['xlsx'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Optional: Increase visual warning limit to 1000kB
  }
})
