import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO, COOKIE_CONEXAO } from '../config/constants.ts';
import { decifrar } from '../lib/cripto.ts';
import { sql } from '../lib/db.ts';
import { entrarComGoogle } from '../services/auth.ts';
import { comCookies, CSRF, limparBanco } from '../test/helpers.ts';

/* --------------------------------------------------- provedor TikTok falso */

const TOKEN = 'token-de-acesso-do-tiktok';
let verifierRecebido: string | null = null;

function montarFetchFalso() {
  vi.stubGlobal('fetch', async (entrada: unknown, init?: { body?: URLSearchParams }) => {
    const url = String(entrada);
    if (url.includes('/oauth/token/')) {
      verifierRecebido = new URLSearchParams(init?.body).get('code_verifier');
      return Response.json({
        access_token: TOKEN,
        refresh_token: 'refresh-do-tiktok',
        expires_in: 86400,
        open_id: 'open-id-da-ana',
        scope: 'user.info.basic,video.list',
      });
    }
    if (url.includes('/user/info/')) {
      return Response.json({
        data: { user: { display_name: 'ana.creator', avatar_url: 'https://cdn/ana.jpg' } },
      });
    }
    throw new Error(`fetch inesperado: ${url}`);
  });
}

/* ----------------------------------------------------------------- testes */

const app = await buildApp();

beforeEach(async () => {
  await limparBanco();
  verifierRecebido = null;
  montarFetchFalso();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => app.close());

async function logar(email = 'ana@gmail.com') {
  const { tokens } = await entrarComGoogle(
    { providerUserId: `g-${email}`, email, nome: 'Ana' },
    { userAgent: null, ip: null },
    null,
  );
  return tokens!.acesso;
}

function cookieBruto(res: { headers: Record<string, unknown> }, nome: string) {
  const lista = ([] as string[]).concat((res.headers['set-cookie'] as string[]) ?? []);
  return lista.find((c) => c.startsWith(`${nome}=`))?.split(';')[0] ?? '';
}

async function conectar(acesso: string) {
  const inicio = await app.inject({
    method: 'POST',
    url: '/connections/tiktok/start',
    headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: acesso }) },
    payload: {},
  });
  const url = new URL(inicio.json().authorizeUrl);
  const callback = await app.inject({
    method: 'GET',
    url: `/connections/tiktok/callback?code=codigo-bom&state=${url.searchParams.get('state')}`,
    headers: { cookie: `${cookieBruto(inicio, COOKIE_CONEXAO)}; ${COOKIE_ACESSO}=${acesso}` },
  });
  return { inicio, url, callback };
}

describe('conexões com o TikTok', () => {
  it('sem conexão, a lista de contas vem vazia', async () => {
    const acesso = await logar();
    const cabecalho = comCookies({ [COOKIE_ACESSO]: acesso });

    const contas = await app.inject({ method: 'GET', url: '/accounts', headers: cabecalho });
    expect(contas.json()).toEqual([]);

    const sessao = await app.inject({ method: 'GET', url: '/auth/session', headers: cabecalho });
    expect(sessao.json().accounts).toEqual([]);
  });

  it('conecta a conta de vídeos e a mostra em /accounts', async () => {
    const acesso = await logar();
    const { url, callback } = await conectar(acesso);

    expect(url.origin).toBe('https://www.tiktok.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('user.info.basic,video.list');
    expect(verifierRecebido).toBeTruthy();

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toContain('/configuracoes?conectado=1');

    const contas = await app.inject({
      method: 'GET',
      url: '/accounts',
      headers: comCookies({ [COOKIE_ACESSO]: acesso }),
    });
    expect(contas.json()).toEqual([
      {
        id: expect.any(String),
        username: 'ana.creator',
        avatarUrl: 'https://cdn/ana.jpg',
        // A parte de pedidos continua desligada: é o estado "sem Shop" das telas.
        shopConnected: false,
        connectedAt: expect.any(String),
        lastSyncedAt: null,
        expiresAt: expect.any(String),
      },
    ]);
  });

  it('guarda o token cifrado, nunca em texto claro', async () => {
    await conectar(await logar());

    const [linha] = await sql<{ access_token: Buffer; refresh_token: Buffer }[]>`
      select access_token, refresh_token from provider_connections`;
    expect(linha!.access_token.toString('utf8')).not.toContain(TOKEN);
    expect(decifrar(Buffer.from(linha!.access_token))).toBe(TOKEN);
    expect(decifrar(Buffer.from(linha!.refresh_token))).toBe('refresh-do-tiktok');
  });

  it('recusa o callback com state que não bate', async () => {
    const acesso = await logar();
    const inicio = await app.inject({
      method: 'POST',
      url: '/connections/tiktok/start',
      headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: acesso }) },
      payload: {},
    });

    const res = await app.inject({
      method: 'GET',
      url: '/connections/tiktok/callback?code=codigo-bom&state=outro',
      headers: { cookie: `${cookieBruto(inicio, COOKIE_CONEXAO)}; ${COOKIE_ACESSO}=${acesso}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('conectar os pedidos responde indisponível enquanto o Shop não libera', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connections/tiktok/start',
      headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: await logar() }) },
      payload: { kind: 'SHOP' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('TIKTOK_SHOP_INDISPONIVEL');
  });

  it('desconecta e apaga o token; conexão de outra pessoa não existe', async () => {
    const acesso = await logar();
    await conectar(acesso);
    const cabecalho = comCookies({ [COOKIE_ACESSO]: acesso });
    const [conta] = (
      await app.inject({ method: 'GET', url: '/accounts', headers: cabecalho })
    ).json();

    const deOutro = await app.inject({
      method: 'DELETE',
      url: `/connections/${conta.id}`,
      headers: { ...CSRF, ...comCookies({ [COOKIE_ACESSO]: await logar('bia@gmail.com') }) },
    });
    expect(deOutro.statusCode).toBe(404);

    const res = await app.inject({
      method: 'DELETE',
      url: `/connections/${conta.id}`,
      headers: { ...CSRF, ...cabecalho },
    });
    expect(res.statusCode).toBe(204);

    const contas = await app.inject({ method: 'GET', url: '/accounts', headers: cabecalho });
    expect(contas.json()).toEqual([]);
    expect(await sql`select 1 from provider_connections`).toHaveLength(0);
  });
});
