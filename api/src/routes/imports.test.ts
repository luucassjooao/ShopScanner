import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO, LIMITE_ARQUIVO_BYTES } from '../config/constants.ts';
import { statusDoArquivo } from '../lib/affiliate-orders.ts';
import { AMBIENTE_DE_TESTE } from '../test/env.ts';
import { comCookies, cookiesDe, CSRF, limparBanco } from '../test/helpers.ts';

const CONTA = '00000000-0000-0000-0000-0000000000a1';
const SEM_CONTA = '00000000-0000-0000-0000-00000000ffff';

const app = await buildApp();
let autenticado: Record<string, string>;

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

/** Corpo multipart montado à mão: o inject não tem atalho para arquivo. */
function formulario(campo: string, nome: string, conteudo: Buffer) {
  const limite = 'limite-de-teste';
  const cabeca = Buffer.from(
    `--${limite}\r\nContent-Disposition: form-data; name="${campo}"; filename="${nome}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
  );
  const cauda = Buffer.from(`\r\n--${limite}--\r\n`);
  return {
    payload: Buffer.concat([cabeca, conteudo, cauda]),
    headers: { ...CSRF, ...autenticado, 'content-type': `multipart/form-data; boundary=${limite}` },
  };
}

function enviar(nome: string, conteudo: Buffer, accountId = CONTA, campo = 'file') {
  const corpo = formulario(campo, nome, conteudo);
  return app.inject({
    method: 'POST',
    url: `/imports?accountId=${accountId}`,
    ...corpo,
  });
}

/** O processamento roda em segundo plano: espera o lote sair da fila. */
async function esperarFim(id: string) {
  for (let i = 0; i < 100; i++) {
    const res = await app.inject({ method: 'GET', url: `/imports/${id}`, headers: autenticado });
    const lote = res.json();
    if (lote.status === 'FAILED' || lote.status === 'DONE') return lote;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('lote não terminou a tempo');
}

describe('POST /imports', () => {
  it('conta que não é da pessoa responde 404 antes de ler o arquivo', async () => {
    const res = await enviar('relatorio.xlsx', Buffer.from('x'), SEM_CONTA);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NAO_ENCONTRADO');
  });

  it('sem o campo file responde 400 VALIDACAO', async () => {
    const res = await enviar('relatorio.xlsx', Buffer.from('x'), CONTA, 'outro');
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDACAO');
  });

  it('arquivo que não é .xlsx vira lote FAILED com WRONG_EXTENSION, não 500', async () => {
    const res = await enviar('relatorio.csv', Buffer.from('a,b'));
    expect(res.statusCode).toBe(201);
    const lote = await esperarFim(res.json().importId);
    expect(lote).toMatchObject({
      status: 'FAILED',
      kind: 'FILE',
      fileName: 'relatorio.csv',
      accountId: CONTA,
      result: null,
      error: { code: 'WRONG_EXTENSION' },
    });
  });

  it('arquivo acima de 50 MB vira lote FAILED com TOO_LARGE', async () => {
    const res = await enviar('grande.xlsx', Buffer.alloc(LIMITE_ARQUIVO_BYTES + 1));
    expect(res.statusCode).toBe(201);
    const lote = await esperarFim(res.json().importId);
    expect(lote.error.code).toBe('TOO_LARGE');
  });

  it('.xlsx válido entra na fila; sem o parser, o lote termina FAILED com code FAILED', async () => {
    const res = await enviar('affiliate_orders.xlsx', Buffer.from('PK-nao-e-planilha'));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ importId: expect.any(String) });
    const lote = await esperarFim(res.json().importId);
    expect(lote.status).toBe('FAILED');
    expect(lote.error.code).toBe('FAILED');
    expect(lote.error.message).toContain('parser pendente');
  });
});

describe('GET /imports', () => {
  it('lista do mais recente para o mais antigo, com total separado', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/imports?accountId=${CONTA}&pageSize=2`,
      headers: autenticado,
    });
    const corpo = res.json();
    expect(corpo.total).toBeGreaterThanOrEqual(3);
    expect(corpo.items).toHaveLength(2);
    expect(corpo.page).toBe(1);
    expect(corpo.items[0].createdAt >= corpo.items[1].createdAt).toBe(true);
  });

  it('filtra por status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/imports?accountId=${CONTA}&status=FAILED`,
      headers: autenticado,
    });
    const corpo = res.json();
    expect(corpo.items.every((l: { status: string }) => l.status === 'FAILED')).toBe(true);
  });

  it('recusa pageSize acima do teto de 100', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/imports?accountId=${CONTA}&pageSize=101`,
      headers: autenticado,
    });
    expect(res.statusCode).toBe(400);
  });

  it('conta alheia responde 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/imports?accountId=${SEM_CONTA}`,
      headers: autenticado,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /imports/:id', () => {
  it('lote inexistente responde 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/imports/${SEM_CONTA}`,
      headers: autenticado,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('statusDoArquivo', () => {
  it('traduz os rótulos da spec e recusa o que não conhece', () => {
    expect(statusDoArquivo('Liquidado')).toBe('SETTLED');
    expect(statusDoArquivo('Inelegível')).toBe('INELIGIBLE');
    expect(statusDoArquivo('Rótulo inventado')).toBeUndefined();
  });
});
