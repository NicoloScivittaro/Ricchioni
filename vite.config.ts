import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true // permette il collegamento da altri device sulla LAN (futuri controller telefono)
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500
  }
});
