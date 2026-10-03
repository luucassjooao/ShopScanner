import type { OrderStatus } from '@/api/schemas';

/** Cores dos gráficos (CLAUDE.md → Gráficos). */
export const COR = {
  serie: '#C0442C',
  comparacao: '#8A8280',
  texto: '#2B1D1B',
  secundario: '#6E5B57',
  grade: '#F1E4DF',
};

export const COR_STATUS: Record<OrderStatus, string> = {
  SETTLED: '#2F7D5B',
  TO_SETTLE: '#9A6200',
  AWAITING_PAYMENT: '#5F5A58',
  REFUNDED: '#B42318',
  FROZEN: '#6B4FA0',
  // Só vem do arquivo. Sem cor própria no design: fica no cinza de texto secundário.
  INELIGIBLE: '#6E5B57',
};

/** Número só para o traçado; o texto nunca sai daqui. */
export const paraGrafico = (dinheiro: string) => Number(dinheiro);
