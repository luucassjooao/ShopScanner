import type { Order, ProductRow } from '@/api/schemas';
import { formatDataHora, formatDecimal, formatTaxa } from './format';
import { CHANNEL_LABEL, STATUS_LABEL } from './labels';

/**
 * CSV das vendas, uma linha por item, no formato que o Excel em português abre direto:
 * `;` como separador, vírgula decimal e BOM para os acentos.
 */
const COLUNAS = [
  'Data',
  'Pedido',
  'Produto',
  'Loja',
  'Canal',
  'Status',
  'Quantidade',
  'Reembolsados',
  'GMV (R$)',
  'Comissão (R$)',
  'Comissão real',
  'Taxa',
];

const celula = (v: string | number) => {
  const t = String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function vendasCsv(pedidos: Order[]): string {
  const linhas = pedidos.flatMap((o) =>
    o.skus.map((s) => {
      const real = o.status === 'SETTLED' && s.commissionSettled !== null;
      return [
        formatDataHora(o.createdAt),
        o.id,
        s.name,
        s.shopName,
        CHANNEL_LABEL[s.channel],
        STATUS_LABEL[o.status],
        s.quantity,
        s.refundedQuantity,
        formatDecimal(s.gmv),
        formatDecimal(real ? s.commissionSettled! : s.commissionEstimated),
        real ? 'sim' : 'não (estimada)',
        formatTaxa(s.commissionRate),
      ];
    }),
  );
  return '﻿' + [COLUNAS, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
}

/** Parte de `n` em `total`, em %, com uma casa: `"6,7%"`. */
export function percentual(n: number, total: number): string {
  if (!total) return '0,0%';
  return `${((n / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function produtosCsv(produtos: ProductRow[]): string {
  const cabecalho = [
    'Produto',
    'Loja',
    'Itens',
    'GMV (R$)',
    'Comissão estimada (R$)',
    'Taxa',
    'Reembolsados',
    'Canal que mais vendeu',
  ];
  const linhas = produtos.map((p) => [
    p.name,
    p.shopName,
    p.units,
    formatDecimal(p.gmv),
    formatDecimal(p.commission),
    formatTaxa(p.commissionRate),
    p.refundedUnits,
    p.topChannel ? CHANNEL_LABEL[p.topChannel] : '',
  ]);
  return '\uFEFF' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
}

export function baixarArquivo(conteudo: string, nome: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
