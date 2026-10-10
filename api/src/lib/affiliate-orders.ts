/**
 * Tudo que depende da planilha real `affiliate_orders.xlsx` mora aqui, e só aqui.
 * A seção 3 de `docs/parser-affiliate-orders.md` ainda está vazia: nenhuma
 * coluna foi confirmada. Quando a planilha chegar, troca-se o que está marcado
 * como SUPOSTO, e o resto do import não muda.
 */

/**
 * SUPOSTO: os rótulos de status vieram da tabela da spec, não de um arquivo
 * real. Rótulo fora desta lista não é inventado para caber: vira falha.
 */
const STATUS_DO_ARQUIVO: Record<string, string> = {
  Pendente: 'TO_SETTLE',
  'Aguardando pagamento': 'AWAITING_PAYMENT',
  Liquidado: 'SETTLED',
  Inelegível: 'INELIGIBLE',
};

/** Rótulo do arquivo para o `OrderStatus` do contrato. `undefined` quando não é conhecido. */
export function statusDoArquivo(rotulo: string): string | undefined {
  return STATUS_DO_ARQUIVO[rotulo];
}

/**
 * SUPOSTO: nenhuma coluna foi confirmada, então o dicionário nasce vazio. Quando
 * a planilha chegar, cada entrada aqui é `rótulo na planilha → campo do contrato`,
 * em português e em inglês, como pede a spec.
 */
export const COLUNAS: Record<string, string> = {};

/** Erro de quem ainda não tem a planilha real: o lote vai para FAILED com este motivo. */
export class ParserPendente extends Error {
  constructor() {
    super('parser pendente: a planilha real ainda não foi recebida');
    this.name = 'ParserPendente';
  }
}

/**
 * Lê o `.xlsx` e devolve as linhas já mapeadas. Ainda não existe: sem a planilha
 * real não há cabeçalho para conferir, nem moeda, nem WRONG_FILE.
 */
export function lerRelatorio(_arquivo: Buffer): never {
  throw new ParserPendente();
}
