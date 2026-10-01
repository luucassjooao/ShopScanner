import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Valores de faz-de-conta: o teste não fala com serviço externo, só precisa
    // que config/env.ts passe na validação do boot.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://shopscanner:shopscanner@localhost:5432/shopscanner',
      JWT_SECRET: 'x'.repeat(32),
      REFRESH_TOKEN_PEPPER: 'y'.repeat(32),
      ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      COOKIE_DOMAIN: 'localhost',
      WEB_ORIGIN: 'http://localhost:5173',
      PORT: '3333',
    },
  },
});
