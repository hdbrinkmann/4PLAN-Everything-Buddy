import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  envPrefix: 'VITE_',
  base: '/4PLANBuddy/',
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    https: {
      key: '../ssl/key.pem',
      cert: '../ssl/cert.pem',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
  define: {
    // Define environment variables for production
    __DEV__: mode === 'development',
  },
}))
