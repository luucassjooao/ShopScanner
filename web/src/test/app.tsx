import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { criarRotas } from '@/routes/router';

/**
 * Monta o app inteiro (as rotas de verdade) numa URL, com o MSW respondendo por trás.
 *
 * O `queryClient` é criado aqui e entregue a `criarRotas`: os loaders da guarda e os
 * componentes têm de compartilhar o mesmo cache, e cada teste começa com ele vazio.
 */
export function abrir(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(criarRotas(queryClient), { initialEntries: [url] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** Todo o período dos mocks (pedidos de 23/08 a 21/09/2026). */
export const PERIODO = 'de=2026-08-01&ate=2026-09-30';
