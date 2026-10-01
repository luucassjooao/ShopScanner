import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.ts';

/**
 * HS256 à mão, em cima do node:crypto. São três linhas de HMAC e uma comparação
 * em tempo constante; o algoritmo é fixo no código, então não existe o truque de
 * trocar `alg` por `none`. Se um dia precisar de RS256 ou JWKS, troque por uma
 * biblioteca — para o token de acesso próprio, isto basta.
 */

const CABECALHO = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

type Registradas = { iat: number; exp: number };

function assinar(conteudo: string) {
  return createHmac('sha256', env.JWT_SECRET).update(conteudo).digest('base64url');
}

export function criarJwt(claims: Record<string, unknown>, segundos: number): string {
  const iat = Math.floor(Date.now() / 1000);
  const corpo = Buffer.from(JSON.stringify({ ...claims, iat, exp: iat + segundos })).toString(
    'base64url',
  );
  const conteudo = `${CABECALHO}.${corpo}`;
  return `${conteudo}.${assinar(conteudo)}`;
}

/** Devolve as claims ou `null`. Nunca lança: token inválido é caso normal. */
export function lerJwt(
  token: string | undefined,
  opcoes: { ignorarExpiracao?: boolean } = {},
): (Record<string, unknown> & Registradas) | null {
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecalho, corpo, assinatura] = partes as [string, string, string];
  if (cabecalho !== CABECALHO) return null;

  const esperada = Buffer.from(assinar(`${cabecalho}.${corpo}`), 'base64url');
  const recebida = Buffer.from(assinatura, 'base64url');
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;

  try {
    const claims = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (typeof claims?.exp !== 'number' || typeof claims?.iat !== 'number') return null;
    if (!opcoes.ignorarExpiracao && claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
