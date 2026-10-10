import type { FastifyReply } from 'fastify';
import {
  ACESSO_SEGUNDOS,
  CAMINHO_REFRESH,
  COOKIE_ACESSO,
  COOKIE_REFRESH,
  REFRESH_SEGUNDOS,
} from '../config/constants.ts';

// Secure sempre, inclusive em desenvolvimento: os navegadores aceitam cookie
// Secure vindo de localhost, e os prefixos __Host-/__Secure- exigem o atributo.
// Sem Domain de propósito — __Host- proíbe, e o front fica no mesmo site.
const base = { httpOnly: true, secure: true, sameSite: 'lax' } as const;

export function definirCookiesDeSessao(
  reply: FastifyReply,
  tokens: { acesso: string; refresh?: string | null },
) {
  reply.setCookie(COOKIE_ACESSO, tokens.acesso, {
    ...base,
    path: '/',
    maxAge: ACESSO_SEGUNDOS,
  });
  // Sem refresh novo: a rotação foi de outra requisição e o cookie dela fica
  // de pé. Reescrever com o antigo seria devolver um token já queimado.
  if (tokens.refresh) {
    reply.setCookie(COOKIE_REFRESH, tokens.refresh, {
      ...base,
      path: CAMINHO_REFRESH,
      maxAge: REFRESH_SEGUNDOS,
    });
  }
}

export function limparCookiesDeSessao(reply: FastifyReply) {
  reply.clearCookie(COOKIE_ACESSO, { ...base, path: '/' });
  reply.clearCookie(COOKIE_REFRESH, { ...base, path: CAMINHO_REFRESH });
}
