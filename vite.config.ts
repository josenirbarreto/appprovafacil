import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // Permite 'Top-level await' usado pelo PDF.js
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
});