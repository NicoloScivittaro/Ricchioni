import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        controller: resolve(process.cwd(), 'controller.html')
      }
    }
  }
});
