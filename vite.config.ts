import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo atual (development/production)
  // O terceiro argumento '' permite carregar todas as variáveis, não apenas as com prefixo VITE_
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      target: 'esnext', // Permite 'Top-level await' usado pelo PDF.js
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    define: {
      // Define process.env.API_KEY para ser substituído pelo valor real durante o build
      // Usa || '' para garantir que não fique undefined se a variável não existir
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
  };
});