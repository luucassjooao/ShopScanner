import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO } from '../config/constants.ts';
import { sql } from '../lib/db.ts';
import { salvarConexao } from '../repositories/connections.ts';
import { buscarPorEmail } from '../repositories/users.ts';
import { comCookies, cookiesDe, CSRF, limparBanco } from '../test/helpers.ts';

const app = await buildApp();
let autenticado: Record<string, string>;
let contaId: string;

/** Mês corrente em São Paulo, que é o fuso em que a creator pensa. */
const mesAtual = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());

beforeEach(async () => {
  await limparBanco();
  const criada = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: CSRF,
    payload: {
      name: 'Ana',
      email: 'ana@exemplo.com',
      password: 'senha-bem-longa-1',
      acceptedTermsVersion: '2026-09-01',
    },
  });
  autenticado = comCookies({ [COOKIE_ACESSO]: cookiesDe(criada)[COOKIE_ACESSO] }) as Record<
    string,
    string
  >;
  const usuario = await buscarPorEmail('ana@exemplo.com');
  contaId = await salvarConexao({
    userId: usuario!.id,
    kind: 'VIDEOS',
    providerUserId: 'open-id-da-ana',
    username: '@ana',
    avatarUrl: null,
    accessToken: 'token',
    refreshToken: null,
    expiresAt: null,
    scopes: [],
  });
});
afterAll(() => app.close());

const comCorpo = (method: 'POST' | 'PUT' | 'PATCH', url: string, payload: unknown) =>
  app.inject({ method, url, headers: { ...CSRF, ...autenticado }, payload });

describe('pautas', () => {
  it('cria, lista, move de etapa e apaga', async () => {
    const criada = await comCorpo('POST', '/plans', {
      title: 'Tábua de bambu na cozinha',
      productId: '123',
      script: { hook: 'Olha isso', scene1: 'a', scene2: 'b', cta: 'link na bio', caption: '#casa' },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json()).toMatchObject({ status: 'IDEA', title: 'Tábua de bambu na cozinha' });
    const id = criada.json().id;

    const lista = await app.inject({ method: 'GET', url: '/plans', headers: autenticado });
    expect(lista.json()).toHaveLength(1);
    expect(lista.json()[0].script.hook).toBe('Olha isso');

    const movida = await comCorpo('PATCH', `/plans/${id}`, { status: 'RECORDED' });
    expect(movida.json()).toMatchObject({ status: 'RECORDED', title: 'Tábua de bambu na cozinha' });

    const apagada = await app.inject({
      method: 'DELETE',
      url: `/plans/${id}`,
      headers: { ...CSRF, ...autenticado },
    });
    expect(apagada.statusCode).toBe(204);
    expect((await comCorpo('PATCH', `/plans/${id}`, { status: 'POSTED' })).statusCode).toBe(404);
  });

  it('recusa pauta de outra pessoa', async () => {
    const criada = await comCorpo('POST', '/plans', { title: 'Minha pauta' });
    const outra = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: CSRF,
      payload: {
        name: 'Bia',
        email: 'bia@exemplo.com',
        password: 'senha-bem-longa-1',
        acceptedTermsVersion: '2026-09-01',
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/plans/${criada.json().id}`,
      headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: cookiesDe(outra)[COOKIE_ACESSO] }) },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('metas e avisos', () => {
  it('salva a meta e ela aparece no resumo do mês', async () => {
    const salva = await comCorpo('PUT', '/goals', {
      accountId: contaId,
      month: mesAtual(),
      gmv: '5000.00',
      commission: '750.00',
    });
    expect(salva.statusCode).toBe(200);

    const lista = await app.inject({ method: 'GET', url: '/goals', headers: autenticado });
    expect(lista.json()).toEqual([
      { accountId: contaId, month: mesAtual(), gmv: '5000.00', commission: '750.00' },
    ]);

    const resumo = await app.inject({
      method: 'GET',
      url: `/summary?accountId=${contaId}&from=2000-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z`,
      headers: autenticado,
    });
    expect(resumo.json().goal).toEqual({ gmv: '5000.00', commission: '750.00' });
    // Conta sem venda devolve zero de verdade, não nulo.
    expect(resumo.json().gmv).toBe('0.00');
  });

  it('recusa meta com dinheiro em formato errado e conta de outra pessoa', async () => {
    const formato = await comCorpo('PUT', '/goals', {
      accountId: contaId,
      month: mesAtual(),
      gmv: 5000,
      commission: null,
    });
    expect(formato.statusCode).toBe(400);

    const outraConta = await comCorpo('PUT', '/goals', {
      accountId: '00000000-0000-0000-0000-00000000ffff',
      month: mesAtual(),
      gmv: '10.00',
      commission: null,
    });
    expect(outraConta.statusCode).toBe(404);
  });

  it('liga e desliga avisos, com e-mail sempre desligado no MVP', async () => {
    const padrao = await app.inject({
      method: 'GET',
      url: '/me/notifications',
      headers: autenticado,
    });
    expect(padrao.json()).toMatchObject({ orderSettled: true, channels: { email: false } });

    const salvo = await comCorpo('PUT', '/me/notifications', {
      ...padrao.json(),
      orderSettled: false,
      channels: { inApp: true, email: true },
    });
    expect(salvo.json()).toMatchObject({
      orderSettled: false,
      // Pedir e-mail não liga e-mail: não existe envio ainda.
      channels: { inApp: true, email: false },
    });
  });
});

describe('dados da conta', () => {
  it('exporta tudo em JSON, sem hash de senha', async () => {
    await comCorpo('POST', '/plans', { title: 'Pauta exportada' });
    const res = await app.inject({ method: 'GET', url: '/me/export', headers: autenticado });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('shopscanner.json');

    const dados = res.json();
    expect(dados.user.email).toBe('ana@exemplo.com');
    expect(dados.accounts).toHaveLength(1);
    expect(dados.plans).toHaveLength(1);
    expect(JSON.stringify(dados)).not.toContain('$argon2');
  });

  it('excluir a conta apaga a pessoa e tudo que é dela', async () => {
    await comCorpo('POST', '/plans', { title: 'Some comigo' });
    const res = await app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { ...CSRF, ...autenticado },
    });
    expect(res.statusCode).toBe(204);

    const depois = await app.inject({ method: 'GET', url: '/auth/session', headers: autenticado });
    expect(depois.statusCode).toBe(401);
    expect(await sql`select 1 from users`).toHaveLength(0);
    expect(await sql`select 1 from plans`).toHaveLength(0);
    expect(await sql`select 1 from provider_connections`).toHaveLength(0);
  });
});
