import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, resetDb } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { abrir } from '@/test/app';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetDb();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

/** A coluna do quadro no desktop (a primeira no DOM; a do celular vem depois). */
const coluna = (nome: string) => screen.getAllByRole('region', { name: nome })[0]!;
const REVIEW = 'Review honesta do protetor solar';

describe('/planejamento', () => {
  it('cinco colunas e mover pelo menu (alternativa ao arrastar)', async () => {
    abrir('/planejamento');
    await screen.findAllByText(REVIEW);
    for (const c of ['Ideia', 'Roteiro', 'Gravado', 'Editado', 'Postado']) {
      expect(coluna(c)).toBeInTheDocument();
    }
    await userEvent.click(screen.getAllByRole('button', { name: `Mover "${REVIEW}"` })[0]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Gravado' }));
    await waitFor(() => expect(within(coluna('Gravado')).getByText(REVIEW)).toBeInTheDocument());
    expect(db.plans.find((p) => p.id === 'plan_demo_1')?.status).toBe('RECORDED');
  });

  it('arrasta um card para outra coluna', async () => {
    abrir('/planejamento');
    const titulo = (await screen.findAllByText(REVIEW))[0]!;
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

  it('cria um roteiro: o nome sai do gancho e entra na coluna Roteiro', async () => {
    abrir('/planejamento');
    await screen.findAllByText(REVIEW);
    await userEvent.click(screen.getAllByRole('button', { name: /Criar roteiro/ })[0]!);
    const modal = await screen.findByRole('dialog');
    const nome = within(modal).getByLabelText('Nome da pauta');
    expect(nome).toHaveValue('Pauta sem nome');

    await userEvent.type(
      within(modal).getByLabelText('Gancho'),
      'Comprei a escova mais barata e testei por trinta dias',
    );
    expect(nome).toHaveValue('Comprei a escova mais barata e testei…');
    await userEvent.selectOptions(
      within(modal).getByLabelText('Produto'),
      within(modal).getAllByRole('option')[1]!,
    );
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar roteiro' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const criado = db.plans.find((p) => p.title.startsWith('Comprei a escova'));
    expect(criado).toMatchObject({ status: 'SCRIPT', script: { scene1: '' } });
    expect(criado?.productId).not.toBeNull();
  });

  it('renomear o topo do modal vence o gancho', async () => {
    abrir('/planejamento');
    await screen.findAllByText(REVIEW);
    await userEvent.click(within(coluna('Postado')).getByRole('button', { name: /Adicionar/ }));
    const modal = await screen.findByRole('dialog');
    const nome = within(modal).getByLabelText('Nome da pauta');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Meu nome');
    await userEvent.type(within(modal).getByLabelText('Gancho'), 'Outra coisa');
    expect(nome).toHaveValue('Meu nome');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar roteiro' }));
    await waitFor(() =>
      expect(db.plans.find((p) => p.title === 'Meu nome')?.status).toBe('POSTED'),
    );
  });

  it('abre o modal já com o produto quando vem de Produtos', async () => {
    abrir('/planejamento?novo=1&produto=1731805911824555068');
    const modal = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(modal).getByLabelText('Produto')).toHaveValue('1731805911824555068'),
    );
  });

  it('calendário da semana mostra a pauta com a próxima ação', async () => {
    abrir('/planejamento');
    expect(await screen.findAllByText(/^Roteiro · /)).not.toHaveLength(0);
    expect(screen.getAllByText('Nada marcado').length).toBeGreaterThan(0);
  });
});

describe('/configuracoes', () => {
  it('edita o perfil', async () => {
    abrir('/configuracoes');
    const nome = await screen.findByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Carol Dias');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(db.user.name).toBe('Carol Dias'));
  });

  it('troca a senha e recusa a senha atual errada', async () => {
    abrir('/configuracoes');
    await userEvent.click(await screen.findByRole('button', { name: /Trocar senha/ }));
    const modal = await screen.findByRole('dialog');
    await userEvent.type(within(modal).getByLabelText('Senha atual'), 'errada');
    await userEvent.type(within(modal).getByLabelText('Senha nova'), 'nova-senha-123');
    await userEvent.type(within(modal).getByLabelText('Repita a senha nova'), 'nova-senha-123');
    await userEvent.click(within(modal).getByRole('button', { name: 'Trocar senha' }));
    // A API manda só `message` (sem código) para senha errada: a tela não mostra texto técnico.
    // Ver DEVLOG — proposta de código `SENHA_ATUAL_INCORRETA` pendente com a raiz.
    expect(
      await within(modal).findByText('Algum dado enviado não foi aceito. Revise e tente de novo.'),
    ).toBeInTheDocument();

    await userEvent.clear(within(modal).getByLabelText('Senha atual'));
    await userEvent.type(within(modal).getByLabelText('Senha atual'), 'senha-demo-123');
    await userEvent.click(within(modal).getByRole('button', { name: 'Trocar senha' }));
    await waitFor(() => expect(db.password).toBe('nova-senha-123'));
  });

  it('troca a foto', async () => {
    // O `Request` do Node não aceita o FormData do jsdom com arquivo; aqui o envio é
    // interceptado antes do MSW e conferido pelo que sai no corpo.
    const fetchReal = globalThis.fetch;
    const envio = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
      String(url).endsWith('/me/avatar')
        ? new Response(JSON.stringify({ avatarUrl: 'https://example.com/a.jpg' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        : fetchReal(url, init),
    );
    vi.stubGlobal('fetch', envio);
    abrir('/configuracoes');
    const input = await screen.findByLabelText('Escolher foto do perfil');
    await userEvent.upload(input, new File(['x'], 'eu.png', { type: 'image/png' }));
    await waitFor(() =>
      expect(envio).toHaveBeenCalledWith(
        expect.stringMatching(/\/me\/avatar$/),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const [, init] = envio.mock.calls.find(([u]) => String(u).endsWith('/me/avatar'))!;
    expect((init!.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('contas conectadas: uma linha por conexão; desconectar explica e não mexe no acesso', async () => {
    db.shopConnected = false;
    abrir('/configuracoes');
    expect(await screen.findByText(/última leitura há 2 horas/)).toBeInTheDocument();
    expect(screen.getByText('TikTok · vídeos')).toBeInTheDocument();
    expect(screen.getByText('TikTok Shop · pedidos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escolher arquivos .xlsx' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('O que para de funcionar')).toBeInTheDocument();
    // A API apaga por cascade na hora; o aviso não pode prometer prazo nenhum.
    expect(within(modal).getByText('O que é apagado agora')).toBeInTheDocument();
    expect(modal).toHaveTextContent('sai do painel na hora');
    expect(modal).not.toHaveTextContent('em até');
    expect(within(modal).getByText('O que continua')).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole('button', { name: 'Desconectar o TikTok' }));
    expect(await screen.findByRole('button', { name: 'Conectar o TikTok' })).toBeInTheDocument();
    expect(db.tiktokConnected).toBe(false);
    expect(db.google).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Acesso à conta' })).toBeInTheDocument();
  });

  it('conta criada pelo Google aceita os termos no primeiro acesso', async () => {
    db.user.acceptedTermsVersion = null;
    abrir('/configuracoes');
    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent('Falta aceitar os termos');
    // Diálogo que precisa de resposta não oferece o X de fechar.
    expect(within(modal).queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();

    await userEvent.click(within(modal).getByRole('button', { name: 'Li e aceito' }));
    await waitFor(() => expect(db.user.acceptedTermsVersion).toBe('2026-09-22'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('a volta do TikTok explica o que aconteceu, sem mostrar o código', async () => {
    abrir('/configuracoes?conectado=1');
    expect(await screen.findByRole('status')).toHaveTextContent('Conta conectada');

    cleanup();
    abrir('/configuracoes?erro=TIKTOK_SHOP_INDISPONIVEL');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('ainda não foi liberada para a sua conta no Brasil');
    expect(alerta).not.toHaveTextContent('TIKTOK_SHOP_INDISPONIVEL');
  });

  it('pedidos: a recusa vem explicada, sem código cru nem mensagem genérica', async () => {
    db.shopConnected = false;
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    abrir('/configuracoes');
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar conectar' }));

    // A conexão de pedidos responde 503 com código de negócio: nada de navegar.
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('ainda não foi liberada para a sua conta no Brasil');
    expect(alerta).not.toHaveTextContent('TIKTOK_SHOP_INDISPONIVEL');
    expect(alerta).not.toHaveTextContent('problema do nosso lado');
    expect(assign).not.toHaveBeenCalled();
  });

  it('acesso: só com Google, desvincular espera uma senha', async () => {
    db.password = null;
    abrir('/configuracoes');
    const desvincular = await screen.findByRole('button', { name: 'Desvincular' });
    expect(desvincular).toBeDisabled();
    expect(screen.getByText('Defina uma senha antes de desvincular.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Definir senha' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).queryByLabelText('Senha atual')).not.toBeInTheDocument();
    await userEvent.type(within(modal).getByLabelText('Senha nova'), 'NovaSenha1!');
    await userEvent.type(within(modal).getByLabelText('Repita a senha nova'), 'NovaSenha1!');
    await userEvent.click(within(modal).getByRole('button', { name: 'Definir senha' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desvincular' })).toBeEnabled());
    expect(db.password).toBe('NovaSenha1!');

    await userEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
    expect(await screen.findByText('Não vinculado')).toBeInTheDocument();
    expect(db.google).toBeNull();
  });

  it('meta do mês: sugestão, texto decimal e recusa de formato errado', async () => {
    abrir('/configuracoes');
    const campo = await screen.findByLabelText(/Meta de GMV em/);
    await userEvent.type(campo, '15.5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(await screen.findByText('Use valores como 15.000,00.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /20\.000,00/ }));
    expect(campo).toHaveValue('20.000,00');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => expect(db.goals[0]).toMatchObject({ gmv: '20000.00' }));
  });

  it('avisos: "retido ou reembolsado" liga e desliga os dois; e-mail não aparece', async () => {
    abrir('/configuracoes');
    const chave = await screen.findByRole('switch', { name: 'Pedido retido ou reembolsado' });
    expect(chave).toBeChecked();
    await userEvent.click(chave);
    await waitFor(() => {
      expect(db.notifications.orderFrozen).toBe(false);
      expect(db.notifications.orderRefunded).toBe(false);
    });
    expect(db.notifications.channels.email).toBe(false);
    const avisos = screen.getByRole('region', { name: 'Avisos' });
    expect(within(avisos).queryByText(/e-mail/i)).not.toBeInTheDocument();
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
    const campo = within(modal).getByLabelText('Digite EXCLUIR para confirmar');
    await userEvent.type(campo, 'excluir');
    expect(excluir).toBeDisabled();
    await userEvent.clear(campo);
    await userEvent.type(campo, 'EXCLUIR');
    await userEvent.click(excluir);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(db.loggedIn).toBe(false);
  });
});
