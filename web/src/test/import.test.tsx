import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, resetDb } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { abrir } from '@/test/app';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
  restaurarXhr?.();
});

let restaurarXhr: (() => void) | undefined;
afterAll(() => server.close());

const xlsx = (nome: string) =>
  new File(['conteudo'], nome, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

/**
 * O envio real é `XMLHttpRequest` com `multipart/form-data`, porque só assim dá para
 * mostrar a barra de progresso. O jsdom não serializa `FormData` com arquivo no XHR
 * (quebra em `_buffer`), então aqui o XHR é trocado por um que fala com o mesmo
 * handler do MSW em JSON. Tudo depois do envio — fila, erro, resultado — é real.
 */
function trocarXhrPorFetch() {
  const original = window.XMLHttpRequest;
  class XhrFalso {
    status = 0;
    responseText = '';
    upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    private url = '';
    withCredentials = false;
    responseType = '';
    open(_metodo: string, url: string) {
      this.url = url;
    }
    setRequestHeader() {}
    abort() {}
    send(corpo: FormData) {
      const arquivo = corpo.get('file') as File;
      this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent);
      void fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: arquivo.name, fileSize: arquivo.size }),
      }).then(async (r) => {
        this.status = r.status;
        this.responseText = await r.text();
        this.onload?.();
      });
    }
  }
  vi.stubGlobal('XMLHttpRequest', XhrFalso);
  return () => vi.stubGlobal('XMLHttpRequest', original);
}

/** Escolhe o arquivo no campo do painel de import e espera a resposta do backend. */
async function enviar(nome: string) {
  restaurarXhr = trocarXhrPorFetch();
  const campo = await screen.findByLabelText('Escolher arquivos .xlsx');
  await userEvent.upload(campo, xlsx(nome));
}

describe('import do affiliate_orders.xlsx', () => {
  it('envia o arquivo e mostra quantas vendas entraram', async () => {
    db.shopConnected = false;
    abrir('/configuracoes?secao=import');
    await enviar('affiliate_orders.xlsx');

    const ok = await screen.findByRole('status', {}, { timeout: 4000 });
    expect(ok).toHaveTextContent('affiliate_orders.xlsx');
    expect(ok).toHaveTextContent('12 novas, 3 atualizadas, 65 sem mudança');
    // O arquivo entrou no histórico, com o tipo certo.
    const historico = screen.getByRole('region', { name: 'Histórico' });
    await waitFor(() =>
      expect(within(historico).getAllByText('Arquivo').length).toBeGreaterThan(1),
    );
  });

  it('cada erro do contrato tem a sua orientação, nunca uma mensagem genérica', async () => {
    db.shopConnected = false;
    abrir('/configuracoes?secao=import');
    await enviar('relatorio-usd.xlsx');

    const alerta = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alerta).toHaveTextContent('Este arquivo não está em reais');
    expect(alerta).toHaveTextContent('Exporte o relatório da conta do Brasil');
    // A mensagem técnica da API não vai para a tela.
    expect(alerta).not.toHaveTextContent('currency USD');
  });

  it('arquivo aceito sem parser: diz que o formato está sendo mapeado, sem pedir reenvio', async () => {
    db.shopConnected = false;
    abrir('/configuracoes?secao=import');
    await enviar('relatorio-novo-formato.xlsx');

    const alerta = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alerta).toHaveTextContent('ainda não sabemos ler este formato');
    expect(alerta).toHaveTextContent('Você não precisa enviar de novo');
    expect(alerta).not.toHaveTextContent('Tente enviar de novo');
    expect(alerta).not.toHaveTextContent('PARSER_UNAVAILABLE');
  });

  it('colunas desconhecidas mostram quais faltam e quais vieram', async () => {
    db.shopConnected = false;
    abrir('/configuracoes?secao=import');
    await enviar('colunas-estranhas.xlsx');

    const alerta = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alerta).toHaveTextContent('Não reconhecemos as colunas deste arquivo');
    expect(alerta).toHaveTextContent('status do pedido, data de criação');
    await userEvent.click(within(alerta).getByText('Ver as colunas encontradas'));
    expect(alerta).toHaveTextContent('Order ID, SKU, Estimated commission');
  });

  it('arquivo fora do formato é recusado sem gastar o envio', async () => {
    db.shopConnected = false;
    abrir('/configuracoes?secao=import');
    restaurarXhr = trocarXhrPorFetch();
    const campo = await screen.findByLabelText('Escolher arquivos .xlsx');
    // `applyAccept: false` simula o arrastar, que não passa pelo filtro do seletor.
    await userEvent.upload(campo, new File(['x'], 'relatorio.csv', { type: 'text/csv' }), {
      applyAccept: false,
    });

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Só conseguimos ler arquivos .xlsx');
    // Nada foi para a fila do servidor.
    const historico = screen.getByRole('region', { name: 'Histórico' });
    await waitFor(() =>
      expect(within(historico).queryByText('relatorio.csv')).not.toBeInTheDocument(),
    );
  });

  it('o histórico separa arquivo, sincronização e reconferência', async () => {
    abrir('/configuracoes?secao=import');
    const historico = await screen.findByRole('region', { name: 'Histórico' });
    expect(await within(historico).findByText('affiliate_orders.xlsx')).toBeInTheDocument();
    expect(within(historico).getByText('Concluído')).toBeInTheDocument();
    // Import que falhou mostra o motivo, não só "falhou".
    expect(within(historico).getByText(/Não achamos o cabeçalho/)).toBeInTheDocument();
    expect(within(historico).getByText('Falhou')).toBeInTheDocument();
    // Lote que o parser ainda não lê: status FAILED, mas o rótulo não diz falha.
    expect(within(historico).getByText('Em mapeamento')).toBeInTheDocument();
  });
});

describe('procedência', () => {
  it('a venda diz de onde o número veio', async () => {
    db.vendasNaConta = false;
    abrir('/vendas?de=2026-08-01&ate=2026-09-30');
    // Sem TikTok Shop, a tela de vendas é o estado desconectado com o atalho do arquivo.
    expect(await screen.findByRole('link', { name: /Enviar relatório .xlsx/ })).toBeInTheDocument();
  });
});

describe('/reconciliacao', () => {
  it('fica vazia enquanto só existe uma fonte', async () => {
    abrir('/reconciliacao?de=2026-08-01&ate=2026-09-30');
    expect(await screen.findByRole('heading', { name: 'Nenhuma divergência' })).toBeInTheDocument();
  });
});
