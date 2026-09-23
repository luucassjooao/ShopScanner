import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { db, resetDb } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { AppLayout } from './AppLayout';
import { Configuracoes } from './Configuracoes';
import { Planejamento } from './Planejamento';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetDb();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function abrir(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { path: '/planejamento', element: <Planejamento /> },
          { path: '/configuracoes', element: <Configuracoes /> },
        ],
      },
      { path: '/', element: <p>página inicial</p> },
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

const coluna = (nome: string) => screen.getByRole('region', { name: nome });

describe('/planejamento', () => {
  it('mostra as cinco colunas e move um card pelo select', async () => {
    abrir('/planejamento');
    await screen.findByText('Review honesta do protetor solar');
    for (const c of ['Ideia', 'Roteiro', 'Gravado', 'Editado', 'Postado']) {
      expect(coluna(c)).toBeInTheDocument();
    }
    await userEvent.selectOptions(
      screen.getByLabelText('Mover "Review honesta do protetor solar" para'),
      'RECORDED',
    );
    await waitFor(() =>
      expect(
        within(coluna('Gravado')).getByText('Review honesta do protetor solar'),
      ).toBeInTheDocument(),
    );
    expect(db.plans.find((p) => p.id === 'plan_demo_1')?.status).toBe('RECORDED');
  });

  it('arrasta um card para outra coluna', async () => {
    abrir('/planejamento');
    const titulo = await screen.findByText('Review honesta do protetor solar');
    const dados = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => dados.set(k, v),
      getData: (k: string) => dados.get(k) ?? '',
      effectAllowed: '',
    };
    fireEvent.dragStart(titulo.closest('[draggable]')!, { dataTransfer });
    fireEvent.dragOver(coluna('Editado'), { dataTransfer });
    fireEvent.drop(coluna('Editado'), { dataTransfer });
    await waitFor(() =>
      expect(db.plans.find((p) => p.id === 'plan_demo_1')?.status).toBe('EDITED'),
    );
  });

  it('cria uma ideia com roteiro pelo modal e exige o nome', async () => {
    abrir('/planejamento');
    await userEvent.click(await screen.findByRole('button', { name: /Nova ideia/ }));
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar' }));
    expect(await within(modal).findByText('Dê um nome para a ideia.')).toBeInTheDocument();

    await userEvent.type(within(modal).getByLabelText('Nome da ideia'), 'Unboxing do sérum');
    await userEvent.type(within(modal).getByLabelText('Gancho'), 'Você está usando errado');
    await userEvent.selectOptions(within(modal).getByLabelText('Produto'), 'Sérum Vitamina C 30ml');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(coluna('Ideia')).getByText('Unboxing do sérum')).toBeInTheDocument();
    const criado = db.plans.find((p) => p.title === 'Unboxing do sérum');
    expect(criado?.script).toMatchObject({ hook: 'Você está usando errado', scene1: '' });
    expect(criado?.productId).not.toBeNull();
  });

  it('calendário semanal mostra o plano no dia marcado', async () => {
    abrir('/planejamento?visao=calendario');
    expect(await screen.findByText(/Review honesta do protetor solar/)).toBeInTheDocument();
    expect(screen.getByText(/· hoje/)).toBeInTheDocument();
  });
});

describe('/configuracoes', () => {
  it('mostra perfil, conta conectada e o estado das integrações', async () => {
    abrir('/configuracoes');
    expect(await screen.findByText('voce@email.com.br')).toBeInTheDocument();
    expect(await screen.findByText('@creator.demo.br')).toBeInTheDocument();
    expect(screen.getByText('TikTok Shop conectado')).toBeInTheDocument();
    expect(screen.getByText('TikTok Shop (vendas e comissões)')).toBeInTheDocument();
  });

  it('desconecta a conta depois de confirmar', async () => {
    abrir('/configuracoes');
    await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: 'Desconectar' }));
    expect(await screen.findByRole('button', { name: /Conectar TikTok/ })).toBeInTheDocument();
    expect(db.tiktokConnected).toBe(false);
  });

  it('salva a meta do mês em texto decimal', async () => {
    abrir('/configuracoes');
    const campo = await screen.findByLabelText('Meta de GMV (R$)');
    await userEvent.type(campo, '15.000,00');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => expect(db.goals[0]).toMatchObject({ gmv: '15000.00', commission: null }));
  });

  it('recusa meta em formato que não é pt-BR', async () => {
    abrir('/configuracoes');
    await userEvent.type(await screen.findByLabelText('Meta de GMV (R$)'), '15.5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(await screen.findByText('Use valores como 15.000,00.')).toBeInTheDocument();
    expect(db.goals).toHaveLength(0);
  });

  it('liga e desliga um tipo de aviso; e-mail não aparece', async () => {
    abrir('/configuracoes');
    const chave = await screen.findByRole('switch', { name: 'Uma venda foi reembolsada' });
    expect(chave).toBeChecked();
    await userEvent.click(chave);
    await waitFor(() => expect(db.notifications.orderRefunded).toBe(false));
    expect(db.notifications.channels.email).toBe(false);
    expect(screen.queryByText(/e-mail/i)).not.toBeInTheDocument();
  });

  it('exporta os dados como arquivo JSON', async () => {
    const criar = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    const clicar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    abrir('/configuracoes');
    await userEvent.click(await screen.findByRole('button', { name: /Exportar meus dados/ }));
    await waitFor(() => expect(clicar).toHaveBeenCalled());
    expect(criar).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('só exclui a conta depois de digitar EXCLUIR', async () => {
    const router = abrir('/configuracoes');
    await userEvent.click(await screen.findByRole('button', { name: /Excluir minha conta/ }));
    const modal = await screen.findByRole('dialog');
    const excluir = within(modal).getByRole('button', { name: 'Excluir definitivamente' });
    expect(excluir).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText('Digite EXCLUIR para confirmar'), 'excluir');
    expect(excluir).toBeDisabled();
    await userEvent.clear(within(modal).getByLabelText('Digite EXCLUIR para confirmar'));
    await userEvent.type(within(modal).getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    await userEvent.click(excluir);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(db.loggedIn).toBe(false);
  });
});
