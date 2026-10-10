import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { env } from '../config/env.ts';
import { CSRF, limparBanco } from '../test/helpers.ts';

/**
 * O IP do cliente é a chave do rate limit. Com `trustProxy: true` (como era em
 * produção), trocar o `X-Forwarded-For` a cada tentativa zerava o contador do
 * login. Estes testes sobem a app com a configuração de TRUST_PROXY de cada caso.
 */

const antes = env.TRUST_PROXY;
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

async function appCom(trustProxy: typeof env.TRUST_PROXY) {
  env.TRUST_PROXY = trustProxy;
  const app = await buildApp();
  apps.push(app);
  return app;
}

beforeEach(limparBanco);
afterEach(() => {
  env.TRUST_PROXY = antes;
});
afterAll(async () => {
  for (const app of apps) await app.close();
});

type App = Awaited<ReturnType<typeof buildApp>>;

function tentar(app: App, xff: string, remoteAddress = '127.0.0.1') {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { ...CSRF, 'x-forwarded-for': xff },
    remoteAddress,
    payload: { email: 'alvo@exemplo.com', password: 'chute-errado' },
  });
}

describe('IP do cliente e rate limit atrás de proxy', () => {
  it('sem proxy declarado, X-Forwarded-For forjado não muda o IP: o 11º leva 429', async () => {
    const app = await appCom(false);
    const codigos = [];
    for (let i = 0; i < 11; i++) {
      codigos.push((await tentar(app, `198.51.100.${i}`, '203.0.113.20')).statusCode);
    }
    expect(codigos.at(-1)).toBe(429);
  });

  it('com o proxy declarado, o IP é o que o proxy anotou, não o que o cliente forjou', async () => {
    // O proxy (10.0.0.5) acrescenta o IP real no fim; o cliente controla o começo.
    const app = await appCom(['10.0.0.5']);
    const codigos = [];
    for (let i = 0; i < 11; i++) {
      codigos.push((await tentar(app, `198.51.100.${i}, 203.0.113.30`, '10.0.0.5')).statusCode);
    }
    expect(codigos.at(-1)).toBe(429);

    // E clientes diferentes atrás do mesmo proxy não dividem o contador.
    expect((await tentar(app, '203.0.113.31', '10.0.0.5')).statusCode).toBe(401);
  });

  it('header vindo de quem não é o proxy declarado é ignorado', async () => {
    // Conexão direta à origem, pulando o proxy: o header não vale.
    const app = await appCom(['10.0.0.5']);
    const codigos = [];
    for (let i = 0; i < 11; i++) {
      codigos.push((await tentar(app, `198.51.100.${i}`, '203.0.113.40')).statusCode);
    }
    expect(codigos.at(-1)).toBe(429);
  });
});
