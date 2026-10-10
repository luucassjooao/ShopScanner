import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { env } from '@/env';
import { destinoInterno } from '@/auth/guarda';
import { db, resetDb } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { abrir } from '@/test/app';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetDb();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('guarda de rota', () => {
  it('sem sessão, uma rota do app manda para /entrar', async () => {
    db.loggedIn = false;
    const router = abrir('/inicio');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('sem sessão, a rota interrompida volta na URL para depois do login', async () => {
    db.loggedIn = false;
    const router = abrir('/vendas?status=SETTLED');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(router.state.location.search).toBe('?proxima=%2Fvendas%3Fstatus%3DSETTLED');
  });

  it('com sessão, a rota do app abre', async () => {
    abrir('/inicio');
    expect(await screen.findAllByRole('navigation', { name: 'Menu principal' })).not.toHaveLength(
      0,
    );
  });

  // O furo que o dono achou: logado, a landing continuava aparecendo em `/`.
  it('logado, / vai para /inicio', async () => {
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
    expect(
      screen.queryByRole('heading', {
        name: 'Descubra quanto você realmente ganhou com as suas vendas',
      }),
    ).not.toBeInTheDocument();
  });

  // A exceção: as duas páginas legais vão para a revisão do app no TikTok e abrem para
  // qualquer um. Expulsar quem está logado delas quebraria essa exigência.
  it('logado, /termos continua abrindo', async () => {
    const router = abrir('/termos');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Termos de Uso' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/termos');
  });

  it('logado, /privacidade continua abrindo', async () => {
    const router = abrir('/privacidade');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Política de Privacidade' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/privacidade');
  });

  // Rede caída não é sessão vencida: pedir a senha de novo esconderia a falha.
  it('falha de rede na sessão mostra erro, e não manda para /entrar', async () => {
    server.use(
      http.get(`${env.apiUrl}/auth/session`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    const router = abrir('/inicio');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/inicio');
  });

  it('destinoInterno recusa destino de fora', () => {
    expect(destinoInterno('/vendas?status=SETTLED')).toBe('/vendas?status=SETTLED');
    expect(destinoInterno('//evil.example')).toBeNull();
    expect(destinoInterno('https://evil.example')).toBeNull();
    expect(destinoInterno(null)).toBeNull();
  });
});
