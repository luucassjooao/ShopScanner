import { afterAll, expect, it } from 'vitest';
import { buildApp } from './app.ts';

const app = await buildApp();
afterAll(() => app.close());

it('/health responde com o estado do banco', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  const comBanco = res.statusCode === 200;
  expect([200, 503]).toContain(res.statusCode);
  expect(res.json()).toEqual({ status: comBanco ? 'ok' : 'error', db: comBanco });
});

it('só anuncia a origem do front no CORS, com credenciais', async () => {
  const res = await app.inject({
    method: 'OPTIONS',
    url: '/health',
    headers: { origin: 'http://exemplo.invalido', 'access-control-request-method': 'GET' },
  });
  // Origem fixa: o header sai sempre com WEB_ORIGIN, e é o navegador que barra
  // quem não bate. Nunca ecoa a origem de quem pediu.
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  expect(res.headers['access-control-allow-credentials']).toBe('true');
});
