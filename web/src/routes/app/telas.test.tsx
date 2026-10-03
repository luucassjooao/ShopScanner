import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, resetDb } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { abrir, PERIODO } from '@/test/app';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetDb();
  vi.useRealTimers();
  localStorage.clear();
});
afterAll(() => server.close());

/** As linhas de dados da tabela (sem o cabeçalho). */
const linhasDaTabela = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('casca', () => {
  it('menu com as seis áreas, sino e período no topo', async () => {
    abrir(`/inicio?${PERIODO}`);
    const menus = await screen.findAllByRole('navigation', { name: 'Menu principal' });
    const lateral = menus[0]!;
    for (const item of [
      'Início',
      'Vendas',
      'Vídeos',
      'Produtos',
      'Planejamento',
      'Configurações',
    ]) {
      expect(within(lateral).getByRole('link', { name: item })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('group', { name: 'Período' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /^Avisos/ })).toBeInTheDocument();
  });

  it('o período do topo vai para a URL', async () => {
    const router = abrir(`/inicio?${PERIODO}`);
    await screen.findByText('Comissão estimada');
    await userEvent.click(screen.getAllByRole('button', { name: '7 dias' })[0]!);
    expect(router.state.location.search).toMatch(/de=\d{4}-\d{2}-\d{2}&ate=/);
  });
});

describe('/inicio', () => {
  it('KPIs batem com os totais dos mocks', async () => {
    abrir(`/inicio?${PERIODO}`);
    expect(
      await screen.findAllByText('R$ 11.378,50', { normalizer: (t) => t.replace(/\s/g, ' ') }),
    ).not.toHaveLength(0);
    for (const valor of ['R$ 1.424,55', 'R$ 1.023,89', 'R$ 181,22', 'R$ 142,23']) {
      expect(
        screen.getAllByText(valor, { normalizer: (t) => t.replace(/\s/g, ' ') }).length,
      ).toBeGreaterThan(0);
    }
    expect(screen.getByText('115')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'GMV bruto por status' })).toBeInTheDocument();
    // O topo é o elegível e os gráficos são brutos: cada gráfico diz de qual número é feito.
    expect(screen.getAllByText(/O GMV do topo mostra só o elegível/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Vendas recentes' })).toBeInTheDocument();
  });

  it('mostra o progresso da meta do mês', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-22T15:00:00Z'));
    db.goals = [{ accountId: 'acc_1', month: '2026-09', gmv: '20000.00', commission: null }];
    abrir(`/inicio?${PERIODO}`);
    expect(
      await screen.findByRole('progressbar', { name: 'Progresso da meta do mês' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/da meta de R\$\s20\.000,00/)).toBeInTheDocument();
  });

  it('sem TikTok Shop: vídeos aparecem e vendas ficam com cadeado', async () => {
    db.shopConnected = false;
    abrir(`/inicio?${PERIODO}`);
    expect(
      await screen.findByText('Conecte o TikTok Shop para ver comissões e GMV'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Somando os 14 vídeos do período')).toBeInTheDocument();
    expect(screen.getAllByText('Disponível quando você conectar o TikTok Shop')).toHaveLength(4);
  });

  it('primeiro acesso, sem conta do TikTok', async () => {
    db.tiktokConnected = false;
    abrir('/inicio');
    expect(await screen.findByText('Ainda não há dados por aqui')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conectar o TikTok/ })).toBeInTheDocument();
  });

  it('conexão vencida pede para reconectar', async () => {
    db.expiresAt = '2026-09-20T12:00:00.000Z';
    abrir('/inicio');
    expect(await screen.findByText('A conexão com o TikTok expirou')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconectar o TikTok/ })).toBeInTheDocument();
  });
});

describe('/vendas', () => {
  it('filtra pela URL, pagina pelo servidor e abre o detalhe com a composição da taxa', async () => {
    const router = abrir(`/vendas?${PERIODO}&status=TO_SETTLE`);
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument(); // 57 pedidos, 20 por página
    for (const l of linhasDaTabela()) expect(within(l).getByText('A liquidar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    expect(router.state.location.search).toContain('pagina=2');

    await userEvent.click(screen.getAllByRole('button', { name: /^Abrir detalhe da venda/ })[0]!);
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText('Composição da taxa')).toBeInTheDocument();
    for (const t of [
      'Comissão padrão',
      'Base de cálculo',
      'Origem da venda',
      'Quantidade reembolsada',
    ]) {
      expect(within(painel).getByText(t)).toBeInTheDocument();
    }
  });

  it('chips removem o filtro e a busca vai para o servidor', async () => {
    const router = abrir(`/vendas?${PERIODO}&status=REFUNDED`);
    await userEvent.click(await screen.findByRole('button', { name: 'Remover filtro de status' }));
    expect(router.state.location.search).not.toContain('status=');

    const busca = screen.getByRole('searchbox', { name: 'Buscar produto ou loja' });
    await userEvent.type(busca, 'escova{Enter}');
    await waitFor(() => expect(router.state.location.search).toContain('q=escova'));
    // A busca filtra pedidos: o total cai e os pedidos listados têm uma Escova.
    await waitFor(() => {
      const total = Number(
        /de (\d+) pedidos/.exec(screen.getByText(/^Mostrando/).textContent!)?.[1],
      );
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(80);
    });
    expect(linhasDaTabela().some((l) => /Escova/.test(l.textContent ?? ''))).toBe(true);
  });

  it('estado vazio oferece limpar os filtros', async () => {
    abrir(`/vendas?${PERIODO}&q=nada-disso`);
    expect(await screen.findByText('Nenhuma venda neste período')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
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
  it('lista, filtra por loja e marca para regravar', async () => {
    abrir(`/produtos?${PERIODO}`);
    await screen.findByRole('table');
    expect(linhasDaTabela()).toHaveLength(10);

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Filtrar por loja' }),
      'TecnoLar Store',
    );
    await waitFor(() =>
      linhasDaTabela().forEach((l) => expect(l).toHaveTextContent('TecnoLar Store')),
    );

    await userEvent.click(screen.getAllByRole('button', { name: /^Abrir detalhe de/ })[0]!);
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText('Vídeos que promoveram o produto')).toBeInTheDocument();
    await userEvent.click(within(painel).getByRole('button', { name: /Marcar para regravar/ }));
    await waitFor(() =>
      expect(db.plans.some((p) => p.status === 'IDEA' && p.title.startsWith('Regravar:'))).toBe(
        true,
      ),
    );
  });
});

describe('/videos', () => {
  it('sem TikTok Shop, vendas por vídeo ficam indisponíveis, nunca zero', async () => {
    db.shopConnected = false;
    abrir(`/videos?${PERIODO}`);
    expect(
      await screen.findAllByText('Disponível quando você conectar o TikTok Shop'),
    ).toHaveLength(14);
    expect(screen.queryByText(/R\$\s0,00/)).not.toBeInTheDocument();
    expect(screen.queryByText('Sem venda')).not.toBeInTheDocument();
  });

  it('filtra por hashtag, busca pelo título e abre a página do vídeo', async () => {
    const router = abrir(`/videos?${PERIODO}&hashtag=beleza`);
    const cards = await screen.findAllByRole('listitem');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(14);

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar pelo título' }),
      'protetor{Enter}',
    );
    await waitFor(() =>
      screen.getAllByRole('listitem').forEach((c) => expect(c).toHaveTextContent(/Protetor/i)),
    );

    await userEvent.click(within(screen.getAllByRole('listitem')[0]!).getByRole('link'));
    expect(await screen.findByText('Views ao longo do tempo')).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/videos\/\d+$/);
    expect(screen.getByText('GPM (GMV por mil views)')).toBeInTheDocument();
  });

  it('página do vídeo sem TikTok Shop mostra o bloco de vendas bloqueado', async () => {
    db.shopConnected = false;
    abrir('/videos/7547697027617764647');
    expect(await screen.findByText('Views ao longo do tempo')).toBeInTheDocument();
    expect(screen.getByText('Disponível quando você conectar o TikTok Shop')).toBeInTheDocument();
  });
});

describe('/avisos', () => {
  it('deriva os avisos dos pedidos e marca como lidos ao abrir', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-22T15:00:00Z'));
    abrir('/avisos');
    expect(await screen.findByText('Pedido retido pela plataforma')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ver o pedido' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /^Avisos, \d+ não lidos$/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Avisos' })).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('com o tipo desligado, o aviso some', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-22T15:00:00Z'));
    db.notifications.orderFrozen = false;
    abrir('/avisos');
    await screen.findByRole('heading', { name: 'Avisos' });
    await waitFor(() =>
      expect(screen.queryByText('Pedido retido pela plataforma')).not.toBeInTheDocument(),
    );
    expect(await screen.findAllByText('Pedido reembolsado')).not.toHaveLength(0);
  });
});
