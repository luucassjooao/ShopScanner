import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { AMBIENTE_DE_TESTE } from '../test/env.ts';

/**
 * O navegador só manda PATCH, PUT e DELETE se o preflight listar o método em
 * Access-Control-Allow-Methods. O `inject` não aplica CORS por conta própria, mas o
 * plugin roda como hook e responde o preflight, então este teste lê o que o navegador leria.
 */
const app = await buildApp();
afterAll(() => app.close());

function preflight(metodo: string) {
  return app.inject({
    method: 'OPTIONS',
    url: '/me',
    headers: {
      origin: AMBIENTE_DE_TESTE.WEB_ORIGIN,
      'access-control-request-method': metodo,
      'access-control-request-headers': 'x-requested-with,content-type',
    },
  });
}

describe('CORS', () => {
  it.each(['PATCH', 'PUT', 'DELETE', 'POST', 'GET'])('libera %s no preflight', async (metodo) => {
    const res = await preflight(metodo);
    expect(res.statusCode).toBe(204);
    const permitidos = String(res.headers['access-control-allow-methods'] ?? '')
      .split(',')
      .map((m) => m.trim());
    expect(permitidos).toContain(metodo);
  });

  it('mantém a origem do front e as credenciais', async () => {
    const res = await preflight('PATCH');
    expect(res.headers['access-control-allow-origin']).toBe(AMBIENTE_DE_TESTE.WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
