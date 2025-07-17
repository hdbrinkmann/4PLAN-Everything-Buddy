import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production configuration with sub-path support for keycloak.4plan.de/4PLANBuddy
export default defineConfig({
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
    __DEV__: false,
  },
})
