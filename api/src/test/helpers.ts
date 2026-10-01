import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { sql } from '../lib/db.ts';

/** Toda rota que muda estado exige este header. */
export const CSRF = { 'x-requested-with': 'shopscanner' };

export async function limparBanco() {
  await sql`truncate users, sessions, refresh_tokens, auth_identities restart identity cascade`;
}

export function cookiesDe(res: LightMyRequestResponse): Record<string, string> {
  const lista = Array.isArray(res.cookies) ? res.cookies : [res.cookies];
  return Object.fromEntries(lista.map((c) => [c.name, c.value]));
}

/** Monta o header `cookie` só com os cookies informados. */
export function comCookies(cookies: Record<string, string | undefined>): InjectOptions['headers'] {
  const partes = Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`);
  return { cookie: partes.join('; ') };
}
