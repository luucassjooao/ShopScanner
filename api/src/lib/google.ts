import { createHash, createPublicKey, randomBytes, verify, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.ts';
import { AppError } from './errors.ts';

/**
 * OIDC do Google, só o pedaço que o login usa: Authorization Code com PKCE e
 * validação do id_token pela JWKS. Sem biblioteca: são duas chamadas HTTP e
 * uma verificação RS256 que o node:crypto já faz.
 */

const AUTORIZACAO_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const EMISSORES = ['https://accounts.google.com', 'accounts.google.com'];

const CACHE_SEGUNDOS = 60 * 60;
const PISO_ENTRE_BUSCAS_MS = 60 * 1000;

/** Erro único para fora: nunca conta ao cliente qual validação falhou. */
const INVALIDO = () => new AppError(400, 'GOOGLE_INVALIDO', 'Não deu para confirmar essa conta');

export function configurado(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

function credenciais() {
  if (!configurado()) throw new AppError(503, 'GOOGLE_INDISPONIVEL', 'Login com Google desligado');
  return {
    clientId: env.GOOGLE_CLIENT_ID!,
    clientSecret: env.GOOGLE_CLIENT_SECRET!,
    redirectUri: env.GOOGLE_REDIRECT_URI!,
  };
}

const base64url = (b: Buffer) => b.toString('base64url');

/** PKCE S256: o verifier fica no cookie, só o desafio viaja. */
export function desafioPkce() {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) };
}

export function urlDeAutorizacao(dados: { state: string; nonce: string; challenge: string }) {
  const { clientId, redirectUri } = credenciais();
  const url = new URL(AUTORIZACAO_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: dados.state,
    nonce: dados.nonce,
    code_challenge: dados.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

const respostaDeToken = z.object({ id_token: z.string().min(1) });

export async function trocarCodigo(code: string, verifier: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = credenciais();
  const resposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
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
  return corpo.data.id_token;
}

/* ------------------------------------------------------------------- JWKS */

const jwk = z.object({ kid: z.string(), kty: z.literal('RSA'), n: z.string(), e: z.string() });
const jwks = z.object({ keys: z.array(jwk) });

let cache = new Map<string, KeyObject>();
let buscadoEm = 0;

async function chavePorKid(kid: string): Promise<KeyObject | null> {
  const velho = Date.now() - buscadoEm > CACHE_SEGUNDOS * 1000;
  // Kid desconhecido também recarrega: o Google gira as chaves sem avisar.
  // O piso evita virar martelo quando o kid é inventado.
  if (velho || (!cache.has(kid) && Date.now() - buscadoEm > PISO_ENTRE_BUSCAS_MS)) {
    const resposta = await fetch(JWKS_URL).catch(() => null);
    const corpo = jwks.safeParse(await resposta?.json().catch(() => null));
    if (corpo.success) {
      cache = new Map(
        corpo.data.keys.map((k) => [k.kid, createPublicKey({ key: k, format: 'jwk' })]),
      );
      buscadoEm = Date.now();
    }
  }
  return cache.get(kid) ?? null;
}

/** Só para o teste: a JWKS é estado de módulo e não pode vazar entre casos. */
export function limparCacheDeChaves() {
  cache = new Map();
  buscadoEm = 0;
}

/* --------------------------------------------------------------- id_token */

const cabecalho = z.object({ alg: z.literal('RS256'), kid: z.string() });
const corpoIdToken = z.object({
  iss: z.string(),
  aud: z.string(),
  sub: z.string().min(1),
  exp: z.number(),
  nonce: z.string().optional(),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

export type ContaGoogle = {
  providerUserId: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string | null;
};

function decodificar(parte: string): unknown {
  try {
    return JSON.parse(Buffer.from(parte, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export async function validarIdToken(idToken: string, nonceEsperado: string): Promise<ContaGoogle> {
  const partes = idToken.split('.');
  if (partes.length !== 3) throw INVALIDO();
  const [h, p, assinatura] = partes as [string, string, string];

  const cab = cabecalho.safeParse(decodificar(h));
  if (!cab.success) throw INVALIDO();

  const chave = await chavePorKid(cab.data.kid);
  if (!chave) throw INVALIDO();
  if (
    !verify('RSA-SHA256', Buffer.from(`${h}.${p}`), chave, Buffer.from(assinatura, 'base64url'))
  ) {
    throw INVALIDO();
  }

  const corpo = corpoIdToken.safeParse(decodificar(p));
  if (!corpo.success) throw INVALIDO();
  const claims = corpo.data;

  if (!EMISSORES.includes(claims.iss)) throw INVALIDO();
  if (claims.aud !== credenciais().clientId) throw INVALIDO();
  if (claims.exp * 1000 <= Date.now()) throw INVALIDO();
  // Nonce é o que amarra este id_token a este início de fluxo.
  if (claims.nonce !== nonceEsperado) throw INVALIDO();

  return {
    providerUserId: claims.sub,
    email: claims.email ?? null,
    emailVerificado: claims.email_verified === true,
    nome: claims.name ?? null,
  };
}
