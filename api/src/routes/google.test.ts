import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO, COOKIE_OAUTH } from '../config/constants.ts';
import { env } from '../config/env.ts';
import { limparCacheDeChaves } from '../lib/google.ts';
import { AMBIENTE_DE_TESTE } from '../test/env.ts';
import { comCookies, cookiesDe, CSRF, limparBanco } from '../test/helpers.ts';

/* ------------------------------------------------- provedor Google falso */

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'chave-de-teste';
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const base64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

function assinarIdToken(claims: Record<string, unknown>) {
  const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const corpo = base64url(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: AMBIENTE_DE_TESTE.GOOGLE_CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 300,
      ...claims,
    }),
  );
  const assinatura = sign('RSA-SHA256', Buffer.from(`${cabecalho}.${corpo}`), privateKey);
  return `${cabecalho}.${corpo}.${base64url(assinatura)}`;
}

/** O que o Google devolveria nesta rodada do teste. */
let claimsDoProvedor: Record<string, unknown> = {};
let desafioRecebido: string | null = null;
let verifierRecebido: string | null = null;

function montarFetchFalso() {
  vi.stubGlobal('fetch', async (entrada: unknown, init?: { body?: URLSearchParams }) => {
    const url = String(entrada);
    if (url.includes('/oauth2/v3/certs')) return Response.json({ keys: [JWK] });
    if (url.includes('/token')) {
      verifierRecebido = new URLSearchParams(init?.body).get('code_verifier');
      return Response.json({ id_token: assinarIdToken(claimsDoProvedor) });
    }
    throw new Error(`fetch inesperado: ${url}`);
  });
}

/* ----------------------------------------------------------------- testes */

const app = await buildApp();

beforeEach(async () => {
  await limparBanco();
  limparCacheDeChaves();
  claimsDoProvedor = {};
  desafioRecebido = null;
  verifierRecebido = null;
  montarFetchFalso();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => app.close());

/** O cookie assinado precisa voltar byte a byte: pega do Set-Cookie cru. */
function cookieBruto(res: { headers: Record<string, unknown> }, nome: string) {
  const lista = ([] as string[]).concat((res.headers['set-cookie'] as string[]) ?? []);
  return lista.find((c) => c.startsWith(`${nome}=`))?.split(';')[0] ?? '';
}

async function iniciar() {
  const res = await app.inject({ method: 'GET', url: '/auth/google/start' });
  const url = new URL(res.headers.location as string);
  desafioRecebido = url.searchParams.get('code_challenge');
  return {
    cookie: cookieBruto(res, COOKIE_OAUTH),
    state: url.searchParams.get('state')!,
    nonce: url.searchParams.get('nonce')!,
    url,
  };
}

function voltar(inicio: { cookie: string }, query: string) {
  return app.inject({
    method: 'GET',
    url: `/auth/google/callback?${query}`,
    headers: { cookie: inicio.cookie },
  });
}

/** Com a sessão ativa o erro volta para Configurações; sem ela, para o login. */
describe('erro do Google: para onde a mensagem volta', () => {
  const ondeEstou = (acesso?: string) =>
    acesso
      ? `${AMBIENTE_DE_TESTE.WEB_ORIGIN}/configuracoes`
      : `${AMBIENTE_DE_TESTE.WEB_ORIGIN}/entrar`;

  async function registrar() {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: CSRF,
      payload: {
        name: 'Eva',
        email: 'eva@exemplo.com',
        password: 'senha-bem-longa-1',
        acceptedTermsVersion: '2026-09-01',
      },
    });
    return cookiesDe(res)[COOKIE_ACESSO]!;
  }

  /** Sem as chaves, o início responde indisponível. Restaura o que estava antes. */
  async function semChavesDoGoogle(fn: () => Promise<void>) {
    const antes = {
      id: env.GOOGLE_CLIENT_ID,
      segredo: env.GOOGLE_CLIENT_SECRET,
      redirect: env.GOOGLE_REDIRECT_URI,
    };
    env.GOOGLE_CLIENT_ID = undefined;
    env.GOOGLE_CLIENT_SECRET = undefined;
    env.GOOGLE_REDIRECT_URI = undefined;
    try {
      await fn();
    } finally {
      env.GOOGLE_CLIENT_ID = antes.id;
      env.GOOGLE_CLIENT_SECRET = antes.segredo;
      env.GOOGLE_REDIRECT_URI = antes.redirect;
    }
  }

  it('recusa com sessão volta para /configuracoes', async () => {
    const acesso = await registrar();
    const inicio = await iniciar();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/callback?error=access_denied',
      headers: { cookie: `${inicio.cookie}; ${COOKIE_ACESSO}=${acesso}` },
    });
    expect(res.headers.location).toBe(`${ondeEstou(acesso)}?erro=GOOGLE_RECUSADO`);
  });

  it('recusa sem sessão continua em /entrar', async () => {
    const inicio = await iniciar();
    const res = await voltar(inicio, 'error=access_denied');
    expect(res.headers.location).toBe(`${ondeEstou()}?erro=GOOGLE_RECUSADO`);
  });

  it('Google indisponível com sessão volta para /configuracoes', async () => {
    const acesso = await registrar();
    await semChavesDoGoogle(async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/start',
        headers: { cookie: `${COOKIE_ACESSO}=${acesso}` },
      });
      expect(res.headers.location).toBe(`${ondeEstou(acesso)}?erro=GOOGLE_INDISPONIVEL`);
    });
  });

  it('Google indisponível sem sessão continua em /entrar', async () => {
    await semChavesDoGoogle(async () => {
      const res = await app.inject({ method: 'GET', url: '/auth/google/start' });
      expect(res.headers.location).toBe(`${ondeEstou()}?erro=GOOGLE_INDISPONIVEL`);
    });
  });
});

describe('login com Google', () => {
  it('entra, cria a conta e confere o PKCE', async () => {
    const inicio = await iniciar();
    expect(inicio.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(inicio.url.origin).toBe('https://accounts.google.com');

    claimsDoProvedor = {
      sub: 'google-123',
      email: 'ana@gmail.com',
      email_verified: true,
      name: 'Ana Creator',
      nonce: inicio.nonce,
    };

    const res = await voltar(inicio, `code=codigo-bom&state=${inicio.state}`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(AMBIENTE_DE_TESTE.WEB_ORIGIN);

    // O verifier que a API mandou é o do desafio que ela publicou.
    expect(base64url(createHash('sha256').update(verifierRecebido!).digest())).toBe(
      desafioRecebido,
    );

    const cookies = cookiesDe(res);
    const sessao = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: cookies[COOKIE_ACESSO] }),
    });
    expect(sessao.statusCode).toBe(200);
    expect(sessao.json().user).toMatchObject({
      email: 'ana@gmail.com',
      name: 'Ana Creator',
      emailVerified: true,
      hasPassword: false,
    });
    expect(sessao.json().user.identities).toHaveLength(1);
  });

  it('recusa state que não bate, sem contar o motivo', async () => {
    const inicio = await iniciar();
    claimsDoProvedor = {
      sub: 'g-1',
      email: 'b@gmail.com',
      email_verified: true,
      nonce: inicio.nonce,
    };

    const res = await voltar(inicio, 'code=codigo-bom&state=outro-state');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'REQUISICAO_INVALIDA' });
    expect(cookiesDe(res)[COOKIE_ACESSO]).toBeUndefined();
  });

  it('recusa callback sem o cookie do início', async () => {
    const inicio = await iniciar();
    const res = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=x&state=${inicio.state}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it('recusa id_token com nonce divergente', async () => {
    const inicio = await iniciar();
    claimsDoProvedor = {
      sub: 'g-2',
      email: 'c@gmail.com',
      email_verified: true,
      nonce: 'nonce-de-outro-fluxo',
    };

    const res = await voltar(inicio, `code=codigo-bom&state=${inicio.state}`);
    expect(res.statusCode).toBe(400);
    expect(cookiesDe(res)[COOKIE_ACESSO]).toBeUndefined();
  });

  it('não entra com e-mail não verificado', async () => {
    const inicio = await iniciar();
    claimsDoProvedor = {
      sub: 'g-3',
      email: 'd@gmail.com',
      email_verified: false,
      nonce: inicio.nonce,
    };

    const res = await voltar(inicio, `code=codigo-bom&state=${inicio.state}`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      `${AMBIENTE_DE_TESTE.WEB_ORIGIN}/entrar?erro=EMAIL_NAO_VERIFICADO`,
    );
    expect(cookiesDe(res)[COOKIE_ACESSO]).toBeUndefined();
  });

  it('volta para o login quando a pessoa recusa no Google', async () => {
    const inicio = await iniciar();
    const res = await voltar(inicio, 'error=access_denied');
    expect(res.headers.location).toBe(
      `${AMBIENTE_DE_TESTE.WEB_ORIGIN}/entrar?erro=GOOGLE_RECUSADO`,
    );
  });

  it('vincula à conta que já existe com o mesmo e-mail', async () => {
    const criada = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: CSRF,
      payload: {
        name: 'Eva',
        email: 'eva@gmail.com',
        password: 'senha-bem-longa-1',
        acceptedTermsVersion: '2026-09-01',
      },
    });
    const idOriginal = criada.json().user.id;

    const inicio = await iniciar();
    claimsDoProvedor = {
      sub: 'g-4',
      email: 'eva@gmail.com',
      email_verified: true,
      nonce: inicio.nonce,
    };
    const res = await voltar(inicio, `code=codigo-bom&state=${inicio.state}`);
    expect(res.statusCode).toBe(302);

    const sessao = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: cookiesDe(res)[COOKIE_ACESSO] }),
    });
    expect(sessao.json().user.id).toBe(idOriginal);
    expect(sessao.json().user.hasPassword).toBe(true);
    expect(sessao.json().user.identities).toHaveLength(1);
  });

  it('usuário logado vincula o Google sem trocar de sessão', async () => {
    const criada = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: CSRF,
      payload: {
        name: 'Dani',
        email: 'dani@exemplo.com',
        password: 'senha-bem-longa-1',
        acceptedTermsVersion: '2026-09-01',
      },
    });
    const acesso = cookiesDe(criada)[COOKIE_ACESSO]!;

    const inicio = await iniciar();
    claimsDoProvedor = {
      sub: 'g-7',
      // E-mail diferente do cadastro: o vínculo vem da sessão, não do e-mail.
      email: 'dani.outro@gmail.com',
      email_verified: true,
      nonce: inicio.nonce,
    };
    const res = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=codigo-bom&state=${inicio.state}`,
      headers: { cookie: `${inicio.cookie}; ${COOKIE_ACESSO}=${acesso}` },
    });
    expect(res.statusCode).toBe(302);
    // Já estava logado: a sessão continua a mesma, sem cookie novo.
    expect(cookiesDe(res)[COOKIE_ACESSO]).toBeUndefined();

    const sessao = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: comCookies({ [COOKIE_ACESSO]: acesso }),
    });
    expect(sessao.json().user.id).toBe(criada.json().user.id);
    expect(sessao.json().user.identities).toEqual([
      { provider: 'GOOGLE', email: 'dani.outro@gmail.com', linkedAt: expect.any(String) },
    ]);
  });

  it('não desvincula o Google quando ele é a única forma de entrar', async () => {
    const inicio = await iniciar();
    claimsDoProvedor = {
      sub: 'g-5',
      email: 'fran@gmail.com',
      email_verified: true,
      nonce: inicio.nonce,
    };
    const entrada = await voltar(inicio, `code=codigo-bom&state=${inicio.state}`);
    const autenticado = comCookies({ [COOKIE_ACESSO]: cookiesDe(entrada)[COOKIE_ACESSO] });

    const lista = await app.inject({
      method: 'GET',
      url: '/auth/identities',
      headers: autenticado,
    });
    expect(lista.json()).toEqual([
      {
        provider: 'GOOGLE',
        email: 'fran@gmail.com',
        linkedAt: expect.any(String),
        canUnlink: false,
      },
    ]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/identities/GOOGLE',
      headers: { ...CSRF, ...autenticado },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('UNICO_ACESSO');
  });

  it('desvincula quando ainda sobra a senha', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: CSRF,
      payload: {
        name: 'Gi',
        email: 'gi@gmail.com',
        password: 'senha-bem-longa-1',
        acceptedTermsVersion: '2026-09-01',
      },
    });
    const inicio = await iniciar();
    claimsDoProvedor = {
      sub: 'g-6',
      email: 'gi@gmail.com',
      email_verified: true,
      nonce: inicio.nonce,
    };
    const entrada = await voltar(inicio, `code=codigo-bom&state=${inicio.state}`);
    const autenticado = comCookies({ [COOKIE_ACESSO]: cookiesDe(entrada)[COOKIE_ACESSO] });

    const lista = await app.inject({
      method: 'GET',
      url: '/auth/identities',
      headers: autenticado,
    });
    expect(lista.json()[0].canUnlink).toBe(true);

    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/identities/GOOGLE',
      headers: { ...CSRF, ...autenticado },
    });
    expect(res.statusCode).toBe(204);

    const depois = await app.inject({
      method: 'GET',
      url: '/auth/identities',
      headers: autenticado,
    });
    expect(depois.json()).toEqual([]);
  });
});
