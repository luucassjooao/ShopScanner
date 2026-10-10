import type { FastifyBaseLogger } from 'fastify';
import { lerRelatorio } from '../lib/affiliate-orders.ts';
import { AppError } from '../lib/errors.ts';
import * as repo from '../repositories/imports.ts';
import type { LinhaLote } from '../repositories/imports.ts';

export type ArquivoEnviado = { nome: string; conteudo: Buffer | null; grande: boolean };

/** Motivo da recusa que não precisa ler o arquivo. Vira `error` do lote, nunca 500. */
function recusar(arquivo: ArquivoEnviado): { codigo: string; mensagem: string } | null {
  if (!arquivo.nome.toLowerCase().endsWith('.xlsx')) {
    return { codigo: 'WRONG_EXTENSION', mensagem: 'arquivo sem extensão .xlsx' };
  }
  if (arquivo.grande || !arquivo.conteudo) {
    return { codigo: 'TOO_LARGE', mensagem: 'arquivo acima de 50 MB' };
  }
  return null;
}

export function mapearLote(l: LinhaLote) {
  return {
    id: l.id,
    accountId: l.account_id,
    kind: l.kind,
    fileName: l.file_name,
    createdAt: l.created_at.toISOString(),
    status: l.status,
    result: l.result,
    error: l.error_code
      ? {
          code: l.error_code,
          message: l.error_message ?? '',
          ...(l.columns_found ? { columnsFound: l.columns_found } : {}),
          ...(l.columns_missing ? { columnsMissing: l.columns_missing } : {}),
        }
      : null,
  };
}

/** Cria o lote e devolve o id. Recusa também vira lote, com `error` preenchido. */
export async function enviar(accountId: string, arquivo: ArquivoEnviado, log: FastifyBaseLogger) {
  const lote = await repo.criarLote({ accountId, kind: 'FILE', fileName: arquivo.nome });
  const motivo = recusar(arquivo);
  if (motivo) {
    await repo.marcarFalhou(lote.id, motivo.codigo, motivo.mensagem);
  } else {
    await repo.guardarArquivo(lote.id, arquivo.conteudo!);
    agendar(log);
  }
  return lote.id;
}

export async function listar(
  filtro: { accountId: string; kind: string | null; status: string | null },
  pagina: { page: number; pageSize: number },
) {
  const { items, total } = await repo.listar(filtro, pagina);
  return { items: items.map(mapearLote), total, page: pagina.page };
}

export async function buscar(userId: string, loteId: string) {
  const lote = await repo.buscar(userId, loteId);
  if (!lote) throw AppError.naoEncontrado('Importação não encontrada');
  return mapearLote(lote);
}

/* ------------------------------------------------------------------- fila */

// ponytail: fila em memória dentro do próprio processo, sem tabela de jobs nem
// worker separado. Teto conhecido: se a API cair no meio, o lote fica PROCESSING
// e não volta sozinho; e se o envio acontecer na janela em que a fila está
// fechando, o lote espera o próximo envio. Upgrade: fila no Postgres com
// recuperação de lotes presos, quando houver mais de um processo.
let rodando = false;

export function agendar(log: FastifyBaseLogger) {
  setImmediate(() => void processarFila(log));
}

/** Processa os lotes em fila até esvaziar. Exportada para o teste rodar sem esperar o timer. */
export async function processarFila(log: FastifyBaseLogger) {
  if (rodando) return;
  rodando = true;
  try {
    for (let lote = await repo.reivindicarProximo(); lote; lote = await repo.reivindicarProximo()) {
      await processar(lote, log);
    }
  } finally {
    rodando = false;
  }
}

async function processar(lote: LinhaLote, log: FastifyBaseLogger) {
  try {
    const conteudo = await repo.lerArquivo(lote.id);
    if (!conteudo) throw new Error('arquivo do lote não encontrado');
    lerRelatorio(conteudo);
  } catch (erro) {
    // Detalhe técnico vai para o log e para o campo de suporte; a tela só lê o `code`.
    const mensagem = erro instanceof Error ? erro.message : 'erro desconhecido';
    log.warn({ importId: lote.id, err: erro }, 'importação falhou');
    await repo.marcarFalhou(lote.id, 'FAILED', mensagem);
  }
}
