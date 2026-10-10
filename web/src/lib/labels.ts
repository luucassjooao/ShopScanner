import type { Channel, ImportBatch, OrderStatus, PlanStatus, Source } from '@/api/schemas';

/** A API manda a chave; o rótulo em português mora aqui. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Aguardando pagamento',
  TO_SETTLE: 'A liquidar',
  SETTLED: 'Liquidado',
  REFUNDED: 'Reembolsado',
  FROZEN: 'Retido',
  // Vem do arquivo, não da API: é o rótulo que a creator vê no app do TikTok.
  INELIGIBLE: 'Inelegível',
};

/** De onde o número veio. Aparece no selo de procedência de toda venda. */
export const SOURCE_LABEL: Record<Source, string> = {
  API: 'da API do TikTok',
  FILE: 'do arquivo',
  ESTIMATED: 'estimado',
};

export const IMPORT_KIND_LABEL: Record<ImportBatch['kind'], string> = {
  FILE: 'Arquivo',
  SYNC: 'Sincronização',
  RECHECK: 'Reconferência',
};

export const IMPORT_STATUS_LABEL: Record<ImportBatch['status'], string> = {
  QUEUED: 'Na fila',
  PROCESSING: 'Processando',
  DONE: 'Concluído',
  FAILED: 'Falhou',
};

/**
 * Rótulo do lote. `FAILED` com `PARSER_UNAVAILABLE` não é falha do arquivo: o parser ainda
 * não existe. O status segue `FAILED` (contrato); só o rótulo muda.
 */
export function rotuloDoLote(lote: Pick<ImportBatch, 'status' | 'error'>): string {
  if (lote.status === 'FAILED' && lote.error?.code === 'PARSER_UNAVAILABLE') return 'Em mapeamento';
  return IMPORT_STATUS_LABEL[lote.status];
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  VIDEO: 'Vídeo',
  LIVE: 'Live',
  PRE_LIVE: 'Pré-live',
  SHOP: 'Vitrine',
  LINKSHARE: 'Link',
  PROMOTION_PAGE: 'Página promocional',
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  IDEA: 'Ideia',
  SCRIPT: 'Roteiro',
  RECORDED: 'Gravado',
  EDITED: 'Editado',
  POSTED: 'Postado',
};
