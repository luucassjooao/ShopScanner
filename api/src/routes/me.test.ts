import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO } from '../config/constants.ts';
import { entrarComGoogle } from '../services/auth.ts';
import { comCookies, cookiesDe, CSRF, limparBanco } from '../test/helpers.ts';

const app = await buildApp();
beforeEach(limparBanco);
afterAll(() => app.close());

const SENHA = 'senha-bem-longa-1';

async function registrar(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: CSRF,
    payload: { name: 'Ana', email, password: SENHA, acceptedTermsVersion: '2026-09-01' },
  });
  return cookiesDe(res)[COOKIE_ACESSO]!;
}

function trocar(acesso: string, payload: Record<string, string>) {
  return app.inject({
    method: 'PUT',
    url: '/me/password',
    headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: acesso }) },
    payload,
  });
}

describe('definir senha', () => {
  it('exige a senha atual de quem já tem senha', async () => {
    const acesso = await registrar('ana@exemplo.com');

    const semAtual = await trocar(acesso, { newPassword: 'outra-senha-longa-2' });
    expect(semAtual.statusCode).toBe(400);
    expect(semAtual.json().error).toBe('SENHA_ATUAL_INCORRETA');

    const errada = await trocar(acesso, {
      currentPassword: 'chute-errado',
      newPassword: 'outra-senha-longa-2',
    });
    expect(errada.statusCode).toBe(400);
  });

  it('troca a senha, derruba as outras sessões e mantém esta aba', async () => {
    const outroAparelho = await registrar('bia@exemplo.com');
    const entrada = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: CSRF,
      payload: { email: 'bia@exemplo.com', password: SENHA },
    });
    const esteAparelho = cookiesDe(entrada)[COOKIE_ACESSO]!;

    const res = await trocar(esteAparelho, {
      currentPassword: SENHA,
      newPassword: 'outra-senha-longa-2',
    });
    expect(res.statusCode).toBe(204);

    // Esta aba segue logada com o cookie novo que veio na resposta.
    const novo = cookiesDe(res)[COOKIE_ACESSO]!;
    expect(novo).toBeTruthy();
    const atual = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: novo }),
    });
    expect(atual.statusCode).toBe(200);

    for (const antigo of [esteAparelho, outroAparelho]) {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/session',
        headers: comCookies({ [COOKIE_ACESSO]: antigo }),
      });
      expect(res.statusCode).toBe(401);
    }
  });

  it('quem entrou pelo Google define a primeira senha sem senha atual', async () => {
    const { tokens } = await entrarComGoogle(
      { providerUserId: 'g-99', email: 'cris@gmail.com', nome: 'Cris' },
      { userAgent: null, ip: null },
      null,
    );
    const acesso = tokens!.acesso;

    const antes = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: acesso }),
    });
    expect(antes.json().user.hasPassword).toBe(false);

    const res = await trocar(acesso, { newPassword: 'primeira-senha-1' });
    expect(res.statusCode).toBe(204);

    const depois = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: cookiesDe(res)[COOKIE_ACESSO] }),
    });
    expect(depois.json().user.hasPassword).toBe(true);

    const entrada = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: CSRF,
      payload: { email: 'cris@gmail.com', password: 'primeira-senha-1' },
    });
    expect(entrada.statusCode).toBe(200);
  });
});
