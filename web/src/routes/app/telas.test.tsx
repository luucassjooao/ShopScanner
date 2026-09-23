import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { db, resetDb } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { AppLayout } from './AppLayout';
import { Produtos } from './Produtos';
import { Vendas } from './Vendas';
import { Videos } from './Videos';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => resetDb());
afterAll(() => server.close());

const PERIODO = 'de=2026-08-01&ate=2026-09-30';

function abrir(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { path: '/vendas', element: <Vendas /> },
          { path: '/produtos', element: <Produtos /> },
          { path: '/videos', element: <Videos /> },
        ],
      },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('/vendas', () => {
  it('lê os filtros da URL, pagina pelo servidor e abre o detalhe com a divisão da comissão', async () => {
    const router = abrir(`/vendas?${PERIODO}&status=TO_SETTLE`);
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument(); // 57 pedidos, 20 por página
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(20);
    for (const l of linhas) expect(within(l).getByText('A liquidar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    expect(router.state.location.search).toContain('pagina=2');

    await userEvent.click(within(screen.getAllByRole('row')[1]).getAllByRole('button')[0]);
    const painel = await screen.findByRole('dialog');
    // Um bloco por item do pedido: pode haver mais de um.
    expect((await within(painel).findAllByText('Divisão da comissão')).length).toBeGreaterThan(0);
    for (const t of ['Taxa padrão', 'Origem da venda', 'Reembolsados', 'Aparece quando liquidar']) {
      expect(within(painel).getAllByText(t).length).toBeGreaterThan(0);
    }
  });

  it('sem TikTok Shop, mostra o estado desconectado', async () => {
    db.shopConnected = false;
    abrir(`/vendas?${PERIODO}`);
    expect(
      await screen.findByText('Conecte o TikTok Shop para ver as suas vendas'),
    ).toBeInTheDocument();
  });
});

describe('/produtos', () => {
  it('lista os produtos e abre os vídeos que promoveram', async () => {
    abrir(`/produtos?${PERIODO}`);
    const primeiro = await screen.findAllByRole('row');
    expect(primeiro).toHaveLength(11); // cabeçalho + 10 produtos
    await userEvent.click(within(primeiro[1]).getByRole('button'));
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText('Vídeos que promoveram')).toBeInTheDocument();
    expect(within(painel).getByText('Ver as vendas deste produto')).toBeInTheDocument();
  });
});

describe('/videos', () => {
  it('sem TikTok Shop, vendas por vídeo aparecem como indisponíveis, nunca zero', async () => {
    db.shopConnected = false;
    abrir(`/videos?${PERIODO}`);
    const avisos = await screen.findAllByText('Disponível quando você conectar o TikTok Shop');
    expect(avisos).toHaveLength(14);
    expect(screen.queryByText(/R\$\s0,00/)).not.toBeInTheDocument();
  });

  it('filtra por hashtag e abre o painel com métricas e a tabela dos snapshots', async () => {
    abrir(`/videos?${PERIODO}&hashtag=beleza`);
    const cards = await screen.findAllByRole('listitem');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(14);

    await userEvent.click(within(cards[0]).getAllByRole('button')[0]);
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText('Views acumuladas')).toBeInTheDocument();
    expect(within(painel).getByText('Ver em tabela')).toBeInTheDocument();
    expect(within(painel).getByText('GPM (GMV por mil views)')).toBeInTheDocument();
  });
});
