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

function editar(acesso: string, payload: Record<string, string>) {
  return app.inject({
    method: 'PATCH',
    url: '/me',
    headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: acesso }) },
    payload,
  });
}

/** Conta criada pelo Google: nasce sem senha, com e-mail verificado e sem aceite dos termos. */
async function criarContaDoGoogle(email: string) {
  const { tokens } = await entrarComGoogle(
    { providerUserId: `g-${email}`, email, nome: 'Cris' },
    { userAgent: null, ip: null },
    null,
  );
  return tokens!.acesso;
}

function trocar(acesso: string, payload: Record<string, string>) {
  return app.inject({
    method: 'PUT',
    url: '/me/password',
    headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: acesso }) },
    payload,
  });
}

describe('editar perfil', () => {
  it('grava o aceite dos termos de quem entrou pelo Google, sem derrubar a sessão', async () => {
    const acesso = await criarContaDoGoogle('cris@gmail.com');

    const res = await editar(acesso, { acceptedTermsVersion: '2026-09-01' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      email: 'cris@gmail.com',
      acceptedTermsVersion: '2026-09-01',
      hasPassword: false,
      emailVerified: true,
    });
    // Sem troca de e-mail, nenhum cookie novo: a sessão atual segue valendo.
    expect(cookiesDe(res)[COOKIE_ACESSO]).toBeUndefined();

    const sessao = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: acesso }),
    });
    expect(sessao.json().user.acceptedTermsVersion).toBe('2026-09-01');
  });

  it('troca o e-mail: desverifica o novo, derruba as outras sessões e mantém esta', async () => {
    const acesso = await criarContaDoGoogle('cris@gmail.com');
    const outroAparelho = (
      await entrarComGoogle(
        { providerUserId: 'g-cris@gmail.com', email: 'cris@gmail.com', nome: 'Cris' },
        { userAgent: null, ip: null },
        null,
      )
    ).tokens!.acesso;

    const res = await editar(acesso, { email: 'cris.nova@exemplo.com' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: 'cris.nova@exemplo.com', emailVerified: false });

    const novo = cookiesDe(res)[COOKIE_ACESSO]!;
    expect(novo).toBeTruthy();
    const atual = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: novo }),
    });
    expect(atual.statusCode).toBe(200);

    for (const antigo of [acesso, outroAparelho]) {
      const velho = await app.inject({
        method: 'GET',
        url: '/auth/session',
        headers: comCookies({ [COOKIE_ACESSO]: antigo }),
      });
      expect(velho.statusCode).toBe(401);
    }
  });

  it('não troca para um e-mail que já é de outra conta', async () => {
    const acesso = await criarContaDoGoogle('cris@gmail.com');
    await registrar('bia@exemplo.com');

    const res = await editar(acesso, { email: 'BIA@exemplo.com' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('EMAIL_EM_USO');
  });

  it('recusa e-mail malformado e nome curto demais', async () => {
    const acesso = await criarContaDoGoogle('cris@gmail.com');

    const email = await editar(acesso, { email: 'nao-e-email' });
    expect(email.statusCode).toBe(400);
    expect(email.json().error).toBe('VALIDACAO');

    const nome = await editar(acesso, { name: 'A' });
    expect(nome.statusCode).toBe(400);
  });
});

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
