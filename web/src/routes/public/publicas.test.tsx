import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { env } from '@/env';
import { db, resetDb } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { abrir } from '@/test/app';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetDb();
  server.resetHandlers();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

describe('landing e páginas legais', () => {
  it('landing leva para criar conta e entrar', async () => {
    abrir('/');
    expect(
      screen.getByRole('heading', {
        name: 'Descubra quanto você realmente ganhou com as suas vendas',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Criar conta' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByText(/data de cada pagamento/)).not.toBeInTheDocument();
  });

  it('termos e privacidade com índice e links cruzados', async () => {
    abrir('/termos');
    expect(screen.getByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeInTheDocument();
    const indice = screen.getByRole('navigation', { name: 'Índice da página' });
    expect(within(indice).getAllByRole('link')).toHaveLength(8);
    await userEvent.click(screen.getAllByRole('link', { name: 'Política de Privacidade' })[0]!);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Política de Privacidade' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lei nº 13\.709\/2018/)).toBeInTheDocument();
  });
});

describe('/entrar', () => {
  it('valida, entra e vai para o início', async () => {
    db.loggedIn = false;
    const router = abrir('/entrar');
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Informe a sua senha.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('E-mail'), 'voce@email.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-demo-123');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar ou ocultar a senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
    expect(db.loggedIn).toBe(true);
  });

  it('429 no login diz para esperar, e nunca diz que a senha não confere', async () => {
    db.loggedIn = false;
    server.use(
      http.post(`${env.apiUrl}/auth/login`, () =>
        HttpResponse.json(
          { message: 'rate limited' },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    );
    abrir('/entrar');
    await userEvent.type(screen.getByLabelText('E-mail'), 'voce@email.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-demo-123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await screen.findByText('Muitas tentativas seguidas. Espere 2 minutos e tente de novo.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('E-mail ou senha não conferem.')).not.toBeInTheDocument();
  });

  it('Google no topo, sem TikTok, e navega para o início do login social', async () => {
    db.loggedIn = false;
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    abrir('/entrar');
    const google = await screen.findByRole('button', { name: 'Continuar com Google' });
    expect(screen.queryByText(/Continuar com TikTok/)).not.toBeInTheDocument();
    // O Google vem antes do formulário.
    expect(
      google.compareDocumentPosition(screen.getByLabelText('E-mail')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(google);
    expect(assign).toHaveBeenCalledWith('http://localhost/api/auth/google/start');
  });

  it('erro do Google vira mensagem em português, nunca o código cru', async () => {
    db.loggedIn = false;
    abrir('/entrar?erro=GOOGLE_RECUSADO');
    expect(await screen.findByRole('alert')).toHaveTextContent('foi cancelado');
  });

  it('código de erro desconhecido cai na mensagem genérica', async () => {
    db.loggedIn = false;
    abrir('/entrar?erro=xpto_42');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não conseguimos concluir');
    expect(alerta).not.toHaveTextContent('xpto_42');
  });

  it('sessão vencida no meio de uma conexão explica o que houve', async () => {
    db.loggedIn = false;
    abrir('/entrar?erro=SESSAO_EXPIRADA');
    expect(await screen.findByRole('alert')).toHaveTextContent('A sua sessão venceu');
  });

  it('com sessão aberta, pula direto para o app', async () => {
    const router = abrir('/entrar');
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
  });
});

describe('/criar-conta', () => {
  it('mede a força da senha, exige o aceite e segue para o início rápido', async () => {
    db.loggedIn = false;
    const router = abrir('/criar-conta');
    await userEvent.type(await screen.findByLabelText('Nome'), 'Ana');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@email.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'Abcdef1!');
    expect(screen.getByText('Força da senha: Forte')).toBeInTheDocument();

    // Sem o aceite, os dois caminhos ficam bloqueados.
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeDisabled();
    expect(screen.getByText('Marque o aceite para liberar o Google e o formulário.')).toBeVisible();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio-rapido'));
  });

  it('nome de 1 letra para na validação do front, sem ir para a API', async () => {
    db.loggedIn = false;
    const router = abrir('/criar-conta');
    await userEvent.type(await screen.findByLabelText('Nome'), 'A');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@email.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'Abcdef1!');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('O nome precisa ter pelo menos 2 letras.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/criar-conta');
  });
});

describe('/recuperar', () => {
  it('envia o link e mostra a confirmação', async () => {
    db.loggedIn = false;
    abrir('/recuperar');
    await userEvent.type(screen.getByLabelText('E-mail'), 'voce@email.com.br');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));
    expect(
      await screen.findByRole('heading', { name: 'Confira o seu e-mail' }),
    ).toBeInTheDocument();
    expect(screen.getByText('voce@email.com.br')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar o link' })).toBeInTheDocument();
  });

  it('conta só com Google recebe a mesma confirmação: a API não diz quem tem conta', async () => {
    db.loggedIn = false;
    db.password = null;
    abrir('/recuperar');
    await userEvent.type(screen.getByLabelText('E-mail'), 'voce@email.com.br');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));
    expect(
      await screen.findByRole('heading', { name: 'Confira o seu e-mail' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
  });
});

describe('/inicio-rapido', () => {
  it('três passos opcionais até a meta de comissão e o painel', async () => {
    db.shopConnected = false;
    const router = abrir('/inicio-rapido');
    expect(await screen.findByText('TikTok conectado')).toBeInTheDocument();
    expect(screen.getByText(/A sua conta está criada/)).toBeInTheDocument();
    const passos = screen.getByRole('list');
    expect(within(passos).getByText('Feito')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByRole('heading', { name: /Conecte o TikTok Shop/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Em liberação no Brasil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escolher arquivos .xlsx' })).toBeInTheDocument();
    expect(screen.queryByText(/e-mail/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fazer depois' }));
    expect(within(passos).getByText('Para depois')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /10\.000,00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e abrir o painel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
    expect(db.goals[0]).toMatchObject({ commission: '10000.00', gmv: null });
  });

  it('o passo deixado para depois continua marcado na próxima visita', async () => {
    localStorage.clear();
    db.shopConnected = false;
    abrir('/inicio-rapido?passo=2');
    await userEvent.click(await screen.findByRole('button', { name: 'Fazer depois' }));
    expect(within(screen.getByRole('list')).getByText('Para depois')).toBeInTheDocument();

    cleanup();
    abrir('/inicio-rapido?passo=2');
    await waitFor(() =>
      expect(within(screen.getByRole('list')).getByText('Para depois')).toBeInTheDocument(),
    );
    localStorage.clear();
  });

  it('sem sessão, manda entrar', async () => {
    db.loggedIn = false;
    const router = abrir('/inicio-rapido');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });
});
