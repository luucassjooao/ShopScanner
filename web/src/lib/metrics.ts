import type {
  Channel,
  Money,
  Order,
  OrderSku,
  OrderStatus,
  ProductRow,
  Summary,
} from '@/api/schemas';
import { divRound, fromCents, toCents } from './money';

/**
 * Métricas derivadas dos pedidos do contrato (CLAUDE.md → "Definições dos números").
 * Não conhecem o formato do TikTok: recebem `Order[]` já no contrato.
 * O MSW usa estas funções para montar /summary e /products; o backend real fará o mesmo lá.
 */

const STATUSES: OrderStatus[] = [
  'AWAITING_PAYMENT',
  'TO_SETTLE',
  'SETTLED',
  'REFUNDED',
  'FROZEN',
  'INELIGIBLE',
];

/**
 * GMV elegível: só o que está a liquidar ou já liquidado. É o número que a creator vê
 * no app do TikTok, e o que o topo do Início mostra (CLAUDE.md → "Definições dos números").
 * O resto — aguardando pagamento, inelegível, reembolsado e retido — vai numa linha à parte.
 */
export const GMV_ELEGIVEL: OrderStatus[] = ['TO_SETTLE', 'SETTLED'];
export const ehElegivel = (status: OrderStatus) => GMV_ELEGIVEL.includes(status);

/** Venda por anúncio da loja: dedução, não campo oficial. Único lugar que decide isso. */
export function isShopAdsSale(sku: OrderSku): boolean {
  return sku.rates.shopAds > 0;
}

const skusDe = (orders: Order[]) => orders.flatMap((o) => o.skus.map((sku) => ({ o, sku })));

/** Comissão estimada somada por status, inclusive os que não vão pagar. */
export function commissionByStatus(orders: Order[]): Record<OrderStatus, Money> {
  const acc = Object.fromEntries(STATUSES.map((s) => [s, 0n])) as Record<OrderStatus, bigint>;
  for (const { o, sku } of skusDe(orders)) acc[o.status] += toCents(sku.commissionEstimated);
  return Object.fromEntries(STATUSES.map((s) => [s, fromCents(acc[s])])) as Record<
    OrderStatus,
    Money
  >;
}

/** KPI "comissão perdida": estimada de REFUNDED + FROZEN. */
export function commissionLost(orders: Order[]): Money {
  const s = commissionByStatus(orders);
  return fromCents(toCents(s.REFUNDED) + toCents(s.FROZEN));
}

/** `2026-09-22` no fuso de São Paulo. */
const diaSP = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const dayKey = (isoDate: string) => diaSP.format(new Date(isoDate));

function somaPor<K>(pares: Iterable<[K, bigint]>) {
  const m = new Map<K, bigint>();
  for (const [k, v] of pares) m.set(k, (m.get(k) ?? 0n) + v);
  return m;
}

/** Agrega por produto. `imageUrl` sai nulo: quem conhece a imagem é a fonte do catálogo. */
export function productRows(orders: Order[]): ProductRow[] {
  const porProduto = new Map<
    string,
    {
      row: ProductRow;
      gmv: bigint;
      commission: bigint;
      pedidos: Set<string>;
      canais: Map<Channel, bigint>;
      ultimo: string;
    }
  >();
  for (const { o, sku } of skusDe(orders)) {
    let p = porProduto.get(sku.productId);
    if (!p) {
      p = {
        row: {
          productId: sku.productId,
          name: sku.name,
          shopName: sku.shopName,
          imageUrl: null,
          gmv: '0.00',
          commission: '0.00',
          commissionRate: sku.commissionRate,
          units: 0,
          refundedUnits: 0,
          ordersCount: 0,
          topChannel: null,
        },
        gmv: 0n,
        commission: 0n,
        pedidos: new Set(),
        canais: new Map(),
        ultimo: o.createdAt,
      };
      porProduto.set(sku.productId, p);
    }
    const gmv = toCents(sku.gmv);
    p.gmv += gmv;
    p.commission += toCents(sku.commissionEstimated);
    p.row.units += sku.quantity;
    p.row.refundedUnits += sku.refundedQuantity;
    p.pedidos.add(o.id);
    p.canais.set(sku.channel, (p.canais.get(sku.channel) ?? 0n) + gmv);
    // A taxa vigente é a do pedido mais recente.
    if (o.createdAt >= p.ultimo) {
      p.ultimo = o.createdAt;
      p.row.commissionRate = sku.commissionRate;
    }
  }
  return [...porProduto.values()]
    .map(({ row, gmv, commission, pedidos, canais }) => ({
      ...row,
      gmv: fromCents(gmv),
      commission: fromCents(commission),
      ordersCount: pedidos.size,
      topChannel:
        [...canais].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))[0]?.[0] ?? null,
    }))
    .sort((a, b) => compareMoney(b.gmv, a.gmv));
}

export function compareMoney(a: Money, b: Money): number {
  const d = toCents(a) - toCents(b);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}

/** Corpo de GET /summary, menos `goal` (que vem das metas, não dos pedidos). */
export function summarize(orders: Order[]): Omit<Summary, 'goal'> {
  const itens = skusDe(orders);
  const gmv = itens.reduce((t, { sku }) => t + toCents(sku.gmv), 0n);
  const porStatus = commissionByStatus(orders);
  const settled = itens.reduce(
    (t, { sku }) => t + (sku.commissionSettled ? toCents(sku.commissionSettled) : 0n),
    0n,
  );

  const dias = new Map<string, { gmv: bigint; commission: bigint }>();
  for (const { o, sku } of itens) {
    const d = dias.get(dayKey(o.createdAt)) ?? { gmv: 0n, commission: 0n };
    d.gmv += toCents(sku.gmv);
    d.commission += toCents(sku.commissionEstimated);
    dias.set(dayKey(o.createdAt), d);
  }

  const gmvStatus = somaPor(itens.map(({ o, sku }) => [o.status, toCents(sku.gmv)]));
  const elegivel = itens.reduce(
    (t, { o, sku }) => t + (ehElegivel(o.status) ? toCents(sku.gmv) : 0n),
    0n,
  );
  const gmvCanal = somaPor(itens.map(({ sku }) => [sku.channel, toCents(sku.gmv)]));

  return {
    gmv: fromCents(gmv),
    gmvEligible: fromCents(elegivel),
    gmvIneligible: fromCents(gmv - elegivel),
    commissionEstimated: fromCents(STATUSES.reduce((t, s) => t + toCents(porStatus[s]), 0n)),
    commissionToReceive: porStatus.TO_SETTLE,
    commissionSettled: fromCents(settled),
    unitsSold: itens.reduce((t, { sku }) => t + sku.quantity, 0),
    ordersCount: orders.length,
    avgTicket: orders.length ? fromCents(divRound(gmv, BigInt(orders.length))) : '0.00',
    // ponytail: só dias com venda; o gráfico preenche os vazios se precisar.
    byDay: [...dias]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, gmv: fromCents(d.gmv), commission: fromCents(d.commission) })),
    byStatus: [...gmvStatus].map(([status, v]) => ({ status, gmv: fromCents(v) })),
    byChannel: [...gmvCanal].map(([channel, v]) => ({ channel, gmv: fromCents(v) })),
    topProducts: productRows(orders)
      .slice(0, 5)
      .map(({ productId, name, shopName, gmv, commission, units }) => ({
        productId,
        name,
        shopName,
        gmv,
        commission,
        units,
      })),
  };
}

/** GMV de um pedido: soma do GMV dos SKUs. */
export function orderGmv(order: Order): Money {
  return fromCents(order.skus.reduce((t, s) => t + toCents(s.gmv), 0n));
}

/** Comissão de um pedido: o valor real se já liquidou, senão a estimada. */
export function orderCommission(order: Order): { valor: Money; real: boolean } {
  const real = order.status === 'SETTLED';
  const soma = order.skus.reduce(
    (t, s) => t + toCents((real ? s.commissionSettled : null) ?? s.commissionEstimated),
    0n,
  );
  return { valor: fromCents(soma), real };
}
