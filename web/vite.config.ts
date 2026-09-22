import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Os JSONs crus do TikTok ficam em ../mocks, fora de web/.
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    // O fetch do Node não aceita URL relativa; nos testes o MSW atende neste host.
    env: { VITE_API_URL: 'http://localhost/api' },
  },
});
