import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './AppLayout';

const sessao = {
  user: {
    id: 'u_1',
    name: 'Carolina Dias',
    email: 'voce@email.com.br',
    emailVerified: true,
    avatarUrl: null,
    hasPassword: true,
    identities: [],
    acceptedTermsVersion: '2026-09-22',
  },
  accounts: [
    {
      id: 'acc_1',
      username: '@creator.demo.br',
      avatarUrl: null,
      shopConnected: false,
      hasSales: true,
      connectedAt: '2026-08-02T12:00:00.000Z',
      lastSyncedAt: null,
      expiresAt: null,
    },
  ],
};

function responder(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { element: <AppLayout />, children: [{ path: '/inicio', element: <p>conteúdo do app</p> }] },
      { path: '/entrar', element: <p>tela de entrar</p> },
    ],
    { initialEntries: ['/inicio'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('AppLayout', () => {
  it('manda para /entrar quando a sessão não existe', async () => {
    responder({ message: 'sessão expirada' }, 401);
    renderizar();
    expect(await screen.findByText('tela de entrar')).toBeInTheDocument();
  });

  it('mostra a rota filha quando a sessão é válida', async () => {
    responder(sessao);
    renderizar();
    expect(await screen.findByText('conteúdo do app')).toBeInTheDocument();
  });
});
