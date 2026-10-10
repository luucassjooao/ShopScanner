import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { sql } from '../lib/db.ts';

/** Toda rota que muda estado exige este header. */
export const CSRF = { 'x-requested-with': 'shopscanner' };

export async function limparBanco() {
  await sql`truncate users, sessions, refresh_tokens, auth_identities, provider_connections
            restart identity cascade`;
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

/** Corpo multipart montado à mão: o inject não tem atalho para arquivo. */
export function multipartDe(campo: string, nome: string, conteudo: Buffer) {
  const limite = 'limite-de-teste';
  const cabeca = Buffer.from(
    `--${limite}\r\nContent-Disposition: form-data; name="${campo}"; filename="${nome}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
  );
  const cauda = Buffer.from(`\r\n--${limite}--\r\n`);
  return {
    payload: Buffer.concat([cabeca, conteudo, cauda]),
    contentType: `multipart/form-data; boundary=${limite}`,
  };
}
