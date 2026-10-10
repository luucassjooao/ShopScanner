import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO } from '../config/constants.ts';
import { AMBIENTE_DE_TESTE } from '../test/env.ts';
import { comCookies, cookiesDe, CSRF, limparBanco, multipartDe } from '../test/helpers.ts';

const app = await buildApp();
let autenticado: Record<string, string>;

// Assinaturas reais de cada formato, seguidas de bytes quaisquer.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('resto'),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('resto')]);

beforeAll(async () => {
  await limparBanco();
  execFileSync(process.execPath, ['scripts/seed.ts'], {
    env: { ...process.env, ...AMBIENTE_DE_TESTE },
    stdio: 'pipe',
  });
  const entrada = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: CSRF,
    payload: { email: 'demo@shopscanner.app', password: 'demo-shopscanner' },
  });
  expect(entrada.statusCode).toBe(200);
  autenticado = comCookies({ [COOKIE_ACESSO]: cookiesDe(entrada)[COOKIE_ACESSO] }) as Record<
    string,
    string
  >;
});
afterAll(() => app.close());

function enviar(campo: string, nome: string, conteudo: Buffer) {
  const corpo = multipartDe(campo, nome, conteudo);
  return app.inject({
    method: 'POST',
    url: '/me/avatar',
    payload: corpo.payload,
    headers: { ...CSRF, ...autenticado, 'content-type': corpo.contentType },
  });
}

const ler = () => app.inject({ method: 'GET', url: '/me/avatar', headers: autenticado });

describe('avatar', () => {
  it('sem foto, GET responde 404 e nunca uma imagem de espaço reservado', async () => {
    const res = await ler();
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NAO_ENCONTRADO');
  });

  it('PNG enviado vira avatarUrl com ?v=<hash> e volta com o mesmo conteúdo', async () => {
    const res = await enviar('file', 'foto.png', PNG);
    expect(res.statusCode).toBe(200);
    const { avatarUrl } = res.json();
    expect(avatarUrl).toMatch(/^\/me\/avatar\?v=[0-9a-f]{16}$/);

    const img = await ler();
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(img.rawPayload.equals(PNG)).toBe(true);
  });

  it('trocar a imagem muda o hash, e a sessão passa a apontar para a nova URL', async () => {
    const antes = (await enviar('file', 'a.png', PNG)).json().avatarUrl;
    const depois = (await enviar('file', 'b.jpg', JPEG)).json().avatarUrl;
    expect(depois).not.toBe(antes);

    const sessao = await app.inject({ method: 'GET', url: '/auth/session', headers: autenticado });
    expect(sessao.json().user.avatarUrl).toBe(depois);
    expect((await ler()).headers['content-type']).toBe('image/jpeg');
  });

  it('recusa o que não é imagem, pelos bytes e não pelo nome do arquivo', async () => {
    const res = await enviar('file', 'foto.png', Buffer.from('<html>nao sou imagem</html>'));
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDACAO');
  });

  it('recusa imagem acima de 2 MB', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await enviar('file', 'grande.png', grande);
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDACAO');
  });

  it('sem o campo file responde 400', async () => {
    const res = await enviar('outro', 'foto.png', PNG);
    expect(res.statusCode).toBe(400);
  });
});
