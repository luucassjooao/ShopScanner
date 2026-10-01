import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO, COOKIE_REFRESH } from '../config/constants.ts';
import { pedirRedefinicao } from '../services/auth.ts';
import { comCookies, cookiesDe, CSRF, limparBanco } from '../test/helpers.ts';

const app = await buildApp();
beforeEach(limparBanco);
afterAll(() => app.close());

const SENHA = 'senha-bem-longa-1';

function conta(email: string) {
  return { name: 'Ana Creator', email, password: SENHA, acceptedTermsVersion: '2026-09-01' };
}

async function registrar(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: CSRF,
    payload: conta(email),
  });
  return { res, cookies: cookiesDe(res) };
}

async function entrar(email: string, password = SENHA) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: CSRF,
    payload: { email, password },
  });
  return { res, cookies: cookiesDe(res) };
}

describe('conta e sessão', () => {
  it('registra, entra e lê a sessão — sem nenhum token no corpo', async () => {
    const criada = await registrar('ana@exemplo.com');
    expect(criada.res.statusCode).toBe(201);
    expect(criada.res.json().user).toMatchObject({
      email: 'ana@exemplo.com',
      hasPassword: true,
      identities: [],
      acceptedTermsVersion: '2026-09-01',
    });
    expect(JSON.stringify(criada.res.json())).not.toMatch(/eyJhbGciOi|token/i);
    expect(criada.cookies[COOKIE_ACESSO]).toBeTruthy();
    expect(criada.cookies[COOKIE_REFRESH]).toBeTruthy();

    // O cookie de refresh não viaja fora de /auth/refresh.
    const atributos = Object.fromEntries(criada.res.cookies.map((c) => [c.name, c]));
    expect(atributos[COOKIE_ACESSO]).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
    });
    expect(atributos[COOKIE_REFRESH]).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/auth/refresh',
    });

    const entrada = await entrar('ana@exemplo.com');
    expect(entrada.res.statusCode).toBe(200);

    const sessao = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: entrada.cookies[COOKIE_ACESSO] }),
    });
    expect(sessao.statusCode).toBe(200);
    expect(sessao.json().user.email).toBe('ana@exemplo.com');
    expect(sessao.json().accounts).toEqual([]);
  });

  it('responde igual para e-mail que não existe e senha errada', async () => {
    await registrar('bia@exemplo.com');
    const errada = await entrar('bia@exemplo.com', 'outra-senha-longa');
    const inexistente = await entrar('ninguem@exemplo.com', 'outra-senha-longa');
    expect(errada.res.statusCode).toBe(401);
    expect(inexistente.res.statusCode).toBe(401);
    expect(inexistente.res.json()).toEqual(errada.res.json());
  });

  it('recusa requisição que muda estado sem o X-Requested-With', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ana@exemplo.com', password: SENHA },
    });
    expect(res.statusCode).toBe(403);
  });

  it('gira o refresh a cada uso', async () => {
    const { cookies } = await registrar('cris@exemplo.com');

    const girado = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { ...CSRF, ...comCookies({ [COOKIE_REFRESH]: cookies[COOKIE_REFRESH] }) },
    });
    expect(girado.statusCode).toBe(204);

    const novos = cookiesDe(girado);
    expect(novos[COOKIE_REFRESH]).toBeTruthy();
    expect(novos[COOKIE_REFRESH]).not.toBe(cookies[COOKIE_REFRESH]);

    const sessao = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: novos[COOKIE_ACESSO] }),
    });
    expect(sessao.statusCode).toBe(200);
  });

  it('refresh reutilizado derruba a família inteira e encerra a sessão', async () => {
    const { cookies: primeiro } = await registrar('dani@exemplo.com');

    const girado = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { ...CSRF, ...comCookies({ [COOKIE_REFRESH]: primeiro[COOKIE_REFRESH] }) },
    });
    const segundo = cookiesDe(girado);

    const reuso = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { ...CSRF, ...comCookies({ [COOKIE_REFRESH]: primeiro[COOKIE_REFRESH] }) },
    });
    expect(reuso.statusCode).toBe(401);

    // O token bom também morre: a família inteira foi queimada.
    const depois = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { ...CSRF, ...comCookies({ [COOKIE_REFRESH]: segundo[COOKIE_REFRESH] }) },
    });
    expect(depois.statusCode).toBe(401);

    const sessao = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: segundo[COOKIE_ACESSO] }),
    });
    expect(sessao.statusCode).toBe(401);
  });

  it('dois refresh simultâneos: só um gira', async () => {
    const { cookies } = await registrar('duda@exemplo.com');
    const pedido = () =>
      app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { ...CSRF, ...comCookies({ [COOKIE_REFRESH]: cookies[COOKIE_REFRESH] }) },
      });

    const [a, b] = await Promise.all([pedido(), pedido()]);
    const codigos = [a.statusCode, b.statusCode].sort();
    expect(codigos).toEqual([204, 401]);
  });

  it('sessão revogada não autentica mais', async () => {
    const { cookies } = await registrar('eva@exemplo.com');
    const autenticado = comCookies({ [COOKIE_ACESSO]: cookies[COOKIE_ACESSO] });

    const lista = await app.inject({ method: 'GET', url: '/auth/sessions', headers: autenticado });
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toHaveLength(1);
    expect(lista.json()[0].current).toBe(true);

    const revogada = await app.inject({
      method: 'DELETE',
      url: `/auth/sessions/${lista.json()[0].id}`,
      headers: { ...CSRF, ...autenticado },
    });
    expect(revogada.statusCode).toBe(204);

    const sessao = await app.inject({ method: 'GET', url: '/auth/session', headers: autenticado });
    expect(sessao.statusCode).toBe(401);
  });

  it('logout-all derruba todas as sessões do usuário', async () => {
    const { cookies: uma } = await registrar('fran@exemplo.com');
    const { cookies: outra } = await entrar('fran@exemplo.com');

    const saida = await app.inject({
      method: 'POST',
      url: '/auth/logout-all',
      headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: outra[COOKIE_ACESSO] }) },
    });
    expect(saida.statusCode).toBe(204);

    for (const cookie of [uma, outra]) {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/session',
        headers: comCookies({ [COOKIE_ACESSO]: cookie[COOKIE_ACESSO] }),
      });
      expect(res.statusCode).toBe(401);
    }
  });

  it('redefinir a senha invalida a sessão antiga e o próprio link', async () => {
    const { cookies } = await registrar('gi@exemplo.com');
    const token = await pedirRedefinicao('gi@exemplo.com');
    expect(token).toBeTruthy();

    const trocada = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      headers: CSRF,
      payload: { token, newPassword: 'outra-senha-longa-2' },
    });
    expect(trocada.statusCode).toBe(204);

    const antiga = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: cookies[COOKIE_ACESSO] }),
    });
    expect(antiga.statusCode).toBe(401);

    // O mesmo link não serve duas vezes: a versão das credenciais mudou.
    const repetido = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      headers: CSRF,
      payload: { token, newPassword: 'mais-uma-senha-3' },
    });
    expect(repetido.statusCode).toBe(400);

    expect((await entrar('gi@exemplo.com', 'outra-senha-longa-2')).res.statusCode).toBe(200);
    expect((await entrar('gi@exemplo.com')).res.statusCode).toBe(401);
  });

  it('esqueci a senha não diz se a conta existe', async () => {
    await registrar('hel@exemplo.com');
    for (const email of ['hel@exemplo.com', 'ninguem@exemplo.com']) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        headers: CSRF,
        payload: { email },
      });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
    }
  });

  it('corta a sequência de tentativas de login com 429', async () => {
    await registrar('iza@exemplo.com');
    const respostas = [];
    for (let i = 0; i < 11; i++) {
      respostas.push((await entrar('iza@exemplo.com', 'chute-errado-aqui')).res);
    }
    expect(respostas.at(-1)!.statusCode).toBe(429);
    expect(respostas.at(-1)!.json().error).toBe('MUITAS_REQUISICOES');
    expect(respostas.filter((r) => r.statusCode === 401)).toHaveLength(10);
  });
});
