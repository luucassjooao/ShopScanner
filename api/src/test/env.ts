/** Banco só de teste: as suítes truncam tabelas, então não pode ser o de desenvolvimento. */
export const DATABASE_URL_TESTE =
  process.env.DATABASE_URL_TESTE ??
  'postgres://shopscanner:shopscanner@localhost:5432/shopscanner_test';

/**
 * Valores de faz-de-conta. O teste não fala com serviço externo; isto só
 * precisa passar na validação de `config/env.ts` no boot.
 */
export const AMBIENTE_DE_TESTE = {
  NODE_ENV: 'test',
  PORT: '3333',
  DATABASE_URL: DATABASE_URL_TESTE,
  JWT_SECRET: 'x'.repeat(32),
  REFRESH_TOKEN_PEPPER: 'y'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  COOKIE_DOMAIN: 'localhost',
  WEB_ORIGIN: 'http://localhost:5173',
};
