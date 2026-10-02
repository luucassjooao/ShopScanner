import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.ts';
import { AppError } from './errors.ts';

/**
 * Login Kit do TikTok (OAuth v2 com PKCE), só o necessário para conectar a
 * conta e guardar o token. As chamadas assinadas com HMAC da API de pedidos
 * ficam para a tarefa de sincronização — a Affiliate Creator API nem está
 * liberada para o Brasil ainda.
 */

const AUTORIZACAO_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USUARIO_URL = 'https://open.tiktokapis.com/v2/user/info/';

/** Vídeos da própria creator: é o que a Display API dá hoje. */
const ESCOPOS = ['user.info.basic', 'video.list'];

const INVALIDO = () => new AppError(400, 'TIKTOK_INVALIDO', 'Não deu para conectar essa conta');

export function configurado(): boolean {
  return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REDIRECT_URI);
}

function credenciais() {
  if (!configurado()) {
    throw new AppError(503, 'TIKTOK_INDISPONIVEL', 'Conexão com o TikTok ainda não disponível');
  }
  return {
    clientKey: env.TIKTOK_CLIENT_KEY!,
    clientSecret: env.TIKTOK_CLIENT_SECRET!,
    redirectUri: env.TIKTOK_REDIRECT_URI!,
  };
}

const base64url = (b: Buffer) => b.toString('base64url');

export function desafioPkce() {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) };
}

export function urlDeAutorizacao(dados: { state: string; challenge: string }) {
  const { clientKey, redirectUri } = credenciais();
  const url = new URL(AUTORIZACAO_URL);
  url.search = new URLSearchParams({
    client_key: clientKey,
    scope: ESCOPOS.join(','),
    response_type: 'code',
    redirect_uri: redirectUri,
    state: dados.state,
    code_challenge: dados.challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

const respostaDeToken = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().optional(),
  open_id: z.string().min(1),
  scope: z.string().optional(),
});

export type TokenTiktok = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  openId: string;
  scopes: string[];
};

export async function trocarCodigo(code: string, verifier: string): Promise<TokenTiktok> {
  const { clientKey, clientSecret, redirectUri } = credenciais();
  const resposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  }).catch(() => null);

  if (!resposta?.ok) throw INVALIDO();
  const corpo = respostaDeToken.safeParse(await resposta.json().catch(() => null));
  if (!corpo.success) throw INVALIDO();

  return {
    accessToken: corpo.data.access_token,
    refreshToken: corpo.data.refresh_token ?? null,
    expiresAt: corpo.data.expires_in ? new Date(Date.now() + corpo.data.expires_in * 1000) : null,
    openId: corpo.data.open_id,
    scopes: corpo.data.scope?.split(',').filter(Boolean) ?? [],
  };
}

const respostaDeUsuario = z.object({
  data: z.object({
    user: z.object({
      display_name: z.string().optional(),
      avatar_url: z.string().optional(),
    }),
  }),
});

/** Nome e foto para a tela. Falhar aqui não derruba a conexão. */
export async function dadosDoUsuario(
  accessToken: string,
): Promise<{ username: string | null; avatarUrl: string | null }> {
  const url = new URL(USUARIO_URL);
  url.searchParams.set('fields', 'open_id,display_name,avatar_url');
  const resposta = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  }).catch(() => null);

  const corpo = respostaDeUsuario.safeParse(await resposta?.json().catch(() => null));
  if (!corpo.success) return { username: null, avatarUrl: null };
  return {
    username: corpo.data.data.user.display_name ?? null,
    avatarUrl: corpo.data.data.user.avatar_url ?? null,
  };
}
