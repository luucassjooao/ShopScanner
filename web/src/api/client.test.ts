import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, request } from './client';

function respond(body: unknown, init: ResponseInit = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const schema = z.object({ id: z.string() });

afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('valida a resposta com Zod e devolve o dado tipado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond({ id: 'abc', extra: 1 })),
    );
    await expect(request('/x', { schema })).resolves.toEqual({ id: 'abc' });
  });

  it('manda cookie de sessão e monta a querystring sem valores vazios', async () => {
    const fetchMock = vi.fn(async () => respond({ id: 'abc' }));
    vi.stubGlobal('fetch', fetchMock);

    await request('/orders', { schema, query: { page: 1, status: null, q: '' } });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/orders?page=1');
    expect(url).not.toContain('status');
    expect(url).not.toContain('q=');
    expect(init.credentials).toBe('include');
  });

  it('transforma 401 em nao_autenticado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond({ message: 'expirou' }, { status: 401 })),
    );
    const erro = await request('/auth/session', { schema }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({
      code: 'nao_autenticado',
      status: 401,
      message: 'A sua sessão expirou. Entre de novo para continuar.',
      serverMessage: 'expirou',
    });
    expect((erro as ApiError).isRetryable).toBe(false);
  });

  it('nunca leva a mensagem técnica do backend para message, nem em 4xx de validação', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond({ code: 'X', message: 'Esperávamos um campo que não veio' }, { status: 400 }),
      ),
    );
    const erro = (await request('/x', { schema }).catch((e: unknown) => e)) as ApiError;
    expect(erro.message).not.toContain('Esperávamos');
    expect(erro.message).toBe('Algum dado enviado não foi aceito. Revise e tente de novo.');
    expect(erro.serverCode).toBe('X');
  });

  it('transforma 429 em limitado, com o Retry-After em segundos, e não repete sozinho', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond({ message: 'rate limited' }, { status: 429, headers: { 'Retry-After': '90' } }),
      ),
    );
    const erro = (await request('/auth/login', { schema }).catch((e: unknown) => e)) as ApiError;
    expect(erro.code).toBe('limitado');
    expect(erro.retryAfterSegundos).toBe(90);
    expect(erro.isRetryable).toBe(false);
  });

  it('ignora Retry-After que não é número de segundos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(undefined, {
          status: 429,
          headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' },
        }),
      ),
    );
    const erro = (await request('/auth/login', { schema }).catch((e: unknown) => e)) as ApiError;
    expect(erro.retryAfterSegundos).toBeUndefined();
  });

  it('transforma 500 em servidor, e esse vale repetir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(undefined, { status: 500 })),
    );
    const erro = (await request('/summary', { schema }).catch((e: unknown) => e)) as ApiError;
    expect(erro.code).toBe('servidor');
    expect(erro.isRetryable).toBe(true);
  });

  it('recusa 2xx fora do contrato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond({ id: 42 })),
    );
    const erro = (await request('/x', { schema }).catch((e: unknown) => e)) as ApiError;
    expect(erro.code).toBe('resposta_invalida');
    expect(erro.details).toBeInstanceOf(Array);
  });

  it('transforma falha de fetch em erro de rede', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const erro = (await request('/x', { schema }).catch((e: unknown) => e)) as ApiError;
    expect(erro.code).toBe('rede');
    expect(erro.status).toBe(0);
  });
});
