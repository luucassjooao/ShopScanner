import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { env } from '@/env';
import { ApiError, request, urlDeImagem } from './client';

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

describe('renovação da sessão no 401', () => {
  /** Responde 401 na primeira chamada de cada rota de dado e 2xx depois da renovação. */
  function fetchQueVence() {
    const vencidas = new Set<string>();
    return vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = new URL(url).pathname.replace('/api', '');
      if (caminho === '/auth/refresh') {
        expect(init?.method).toBe('POST');
        // Muda estado: sem o cabeçalho de cliente a API responde 403.
        expect(new Headers(init?.headers).get('X-Requested-With')).toBe('shopscanner');
        return respond(undefined, { status: 204 });
      }
      if (!vencidas.has(caminho)) {
        vencidas.add(caminho);
        return respond({ message: 'access token expirado' }, { status: 401 });
      }
      return respond({ id: 'abc' });
    });
  }

  it('401 renova a sessão uma vez e repete a requisição, sem tela de login', async () => {
    const fetchMock = fetchQueVence();
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/auth/session', { schema })).resolves.toEqual({ id: 'abc' });

    const chamadas = fetchMock.mock.calls.map(([u]) => new URL(u as string).pathname);
    expect(chamadas).toEqual(['/api/auth/session', '/api/auth/refresh', '/api/auth/session']);
  });

  it('várias requisições vencendo juntas disparam uma renovação só', async () => {
    const fetchMock = fetchQueVence();
    vi.stubGlobal('fetch', fetchMock);

    // O caso normal: uma tela faz 8 a 10 consultas e todas tomam 401 ao mesmo tempo.
    const rotas = ['/summary', '/orders', '/videos', '/products', '/plans'];
    await Promise.all(rotas.map((r) => request(r, { schema })));

    const refreshes = fetchMock.mock.calls.filter(
      ([u]) => new URL(u as string).pathname === '/api/auth/refresh',
    );
    expect(refreshes).toHaveLength(1);
  });

  it('401 na própria renovação não vira laço: o erro sobe', async () => {
    const fetchMock = vi.fn(async () => respond({ message: 'morreu' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const erro = await request('/auth/refresh').catch((e: unknown) => e);
    expect(erro).toMatchObject({ code: 'nao_autenticado' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401 no login é senha errada, não sessão vencida: não renova', async () => {
    const fetchMock = vi.fn(async () => respond({ message: 'credencial' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const erro = await request('/auth/login', { body: { email: 'a@b.c' }, method: 'POST' }).catch(
      (e: unknown) => e,
    );
    expect(erro).toMatchObject({ code: 'nao_autenticado' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renovação recusada deixa o nao_autenticado chegar à tela', async () => {
    const fetchMock = vi.fn(async () => respond({ message: 'expirou' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const erro = await request('/auth/session', { schema }).catch((e: unknown) => e);
    expect(erro).toMatchObject({ code: 'nao_autenticado' });
    // sessão, renovação (recusada) e nada mais: não repete o que já se sabe perdido.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('urlDeImagem', () => {
  it('caminho relativo do upload próprio ganha o domínio da API, com o hash', () => {
    expect(urlDeImagem('/me/avatar?v=3f9a')).toBe(`${env.apiUrl}/me/avatar?v=3f9a`);
  });

  it('URL absoluta do TikTok passa intacta: prefixar tudo quebraria a foto da creator', () => {
    const tiktok = 'https://p16-sign.tiktokcdn.com/aweme/avatar.jpeg?x=1';
    expect(urlDeImagem(tiktok)).toBe(tiktok);
  });

  it('protocolo relativo não é caminho da API; ausência continua null', () => {
    expect(urlDeImagem('//cdn.exemplo.com/a.jpg')).toBe('//cdn.exemplo.com/a.jpg');
    expect(urlDeImagem(null)).toBeNull();
  });
});
