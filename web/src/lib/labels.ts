import type { Channel, OrderStatus, PlanStatus } from '@/api/schemas';

/** A API manda a chave; o rótulo em português mora aqui. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Aguardando pagamento',
  TO_SETTLE: 'A liquidar',
  SETTLED: 'Liquidado',
  REFUNDED: 'Reembolsado',
  FROZEN: 'Retido',
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  VIDEO: 'Vídeo',
  LIVE: 'Live',
  PRE_LIVE: 'Pré-live',
  SHOP: 'Vitrine',
  LINKSHARE: 'Link',
  PROMOTION_PAGE: 'Página de promoção',
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  IDEA: 'Ideia',
  SCRIPT: 'Roteiro',
  RECORDED: 'Gravado',
  EDITED: 'Editado',
  POSTED: 'Postado',
};
