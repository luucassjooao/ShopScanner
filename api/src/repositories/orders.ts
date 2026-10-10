import { z } from 'zod';
import { many, sql } from '../lib/db.ts';

/**
 * Pedidos e os cortes de /summary. As contas vivem no SQL — é lá que a soma
 * acontece — e seguem "Definições dos números" do CLAUDE.md da raiz.
 */

export type Periodo = { accountId: string; from: Date; to: Date };

export type FiltroPedidos = {
  status?: string;
  channel?: string;
  productId?: string;
  shopName?: string;
  q?: string;
};

/** Elegível é o que a creator vê como venda válida no app do TikTok. */
const ELEGIVEIS = sql`('TO_SETTLE', 'SETTLED')`;

const dinheiro = z.string();

/** Filtros que olham para o item, não para o pedido. */
function filtroDeItens(f: FiltroPedidos) {
  if (!f.channel && !f.productId && !f.shopName && !f.q) return sql``;
  const canal = f.channel ? sql`and s.channel = ${f.channel}::sale_channel` : sql``;
  const produto = f.productId ? sql`and s.product_id = ${f.productId}` : sql``;
  const loja = f.shopName ? sql`and s.shop_name = ${f.shopName}` : sql``;
  const busca = f.q
    ? sql`and (s.name ilike ${`%${f.q}%`} or s.shop_name ilike ${`%${f.q}%`})`
    : sql``;
  return sql`and exists (
    select 1 from order_skus s
     where s.account_id = o.account_id and s.order_id = o.id
       ${canal} ${produto} ${loja} ${busca}
  )`;
}

function onde(p: Periodo, f: FiltroPedidos = {}) {
  return sql`where o.account_id = ${p.accountId}
               and o.created_at between ${p.from} and ${p.to}
               ${f.status ? sql`and o.status = ${f.status}::order_status` : sql``}
               ${filtroDeItens(f)}`;
}

/* ------------------------------------------------------------------ resumo */

const linhaTotais = z.object({
  gmv: dinheiro,
  gmv_eligible: dinheiro,
  gmv_ineligible: dinheiro,
  commission_estimated: dinheiro,
  commission_to_receive: dinheiro,
  commission_settled: dinheiro,
  units_sold: z.number().int(),
  orders_count: z.number().int(),
  avg_ticket: dinheiro,
});

export async function totais(p: Periodo) {
  const [linha] = await many(
    linhaTotais,
    sql`select coalesce(sum(s.gmv), 0)::numeric(18,2) as gmv,
               coalesce(sum(s.gmv) filter (where o.status in ${ELEGIVEIS}), 0)::numeric(18,2)
                 as gmv_eligible,
               coalesce(sum(s.gmv) filter (where o.status not in ${ELEGIVEIS}), 0)::numeric(18,2)
                 as gmv_ineligible,
               coalesce(sum(s.commission_estimated), 0)::numeric(18,2) as commission_estimated,
               coalesce(sum(s.commission_estimated) filter (where o.status = 'TO_SETTLE'), 0)
                 ::numeric(18,2) as commission_to_receive,
               coalesce(sum(s.commission_settled) filter (where o.status = 'SETTLED'), 0)
                 ::numeric(18,2) as commission_settled,
               coalesce(sum(s.quantity), 0)::int as units_sold,
               count(distinct o.id)::int as orders_count,
               coalesce(round(sum(s.gmv) / nullif(count(distinct o.id), 0), 2), 0)::numeric(18,2)
                 as avg_ticket
          from orders o
          join order_skus s on s.account_id = o.account_id and s.order_id = o.id
          ${onde(p)}`,
  );
  return linha!;
}

export function porDia(p: Periodo) {
  return many(
    z.object({ date: z.string(), gmv: dinheiro, commission: dinheiro }),
    // O dia é o de São Paulo: é assim que a creator lê o próprio calendário.
    sql`select to_char(o.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as date,
               sum(s.gmv)::numeric(18,2) as gmv,
               sum(s.commission_estimated)::numeric(18,2) as commission
          from orders o
          join order_skus s on s.account_id = o.account_id and s.order_id = o.id
          ${onde(p)}
         group by 1 order by 1`,
  );
}

export function porStatus(p: Periodo) {
  return many(
    z.object({ status: z.string(), gmv: dinheiro }),
    sql`select o.status::text as status, sum(s.gmv)::numeric(18,2) as gmv
          from orders o
          join order_skus s on s.account_id = o.account_id and s.order_id = o.id
          ${onde(p)}
         group by 1 order by 1`,
  );
}

export function porCanal(p: Periodo) {
  return many(
    z.object({ channel: z.string(), gmv: dinheiro }),
    sql`select s.channel::text as channel, sum(s.gmv)::numeric(18,2) as gmv
          from orders o
          join order_skus s on s.account_id = o.account_id and s.order_id = o.id
          ${onde(p)}
         group by 1 order by 1`,
  );
}

export function maioresProdutos(p: Periodo, limite = 5) {
  return many(
    z.object({
      product_id: z.string(),
      name: z.string(),
      shop_name: z.string(),
      gmv: dinheiro,
      commission: dinheiro,
      units: z.number().int(),
    }),
    sql`select s.product_id,
               (array_agg(s.name order by o.created_at desc))[1] as name,
               (array_agg(s.shop_name order by o.created_at desc))[1] as shop_name,
               sum(s.gmv)::numeric(18,2) as gmv,
               sum(s.commission_estimated)::numeric(18,2) as commission,
               sum(s.quantity)::int as units
          from orders o
          join order_skus s on s.account_id = o.account_id and s.order_id = o.id
          ${onde(p)}
         group by s.product_id
         order by sum(s.gmv) desc, s.product_id
         limit ${limite}`,
  );
}

/* ------------------------------------------------------------------ listas */

const linhaPedido = z.object({
  id: z.string(),
  created_at: z.date(),
  delivered_at: z.date().nullable(),
  status: z.string(),
  currency: z.string(),
  source: z.string(),
  source_at: z.date(),
});

const linhaSku = z.object({
  order_id: z.string(),
  id: z.string(),
  product_id: z.string(),
  name: z.string(),
  shop_name: z.string(),
  unit_price: dinheiro,
  quantity: z.number().int(),
  returned_quantity: z.number().int(),
  refunded_quantity: z.number().int(),
  gmv: dinheiro,
  commission_base_actual: dinheiro.nullable(),
  commission_rate: z.number().int(),
  rate_standard: z.number().int(),
  rate_shop_ads: z.number().int(),
  rate_bonus: z.number().int(),
  rate_reward: z.number().int(),
  commission_estimated: dinheiro,
  commission_settled: dinheiro.nullable(),
  shop_ads_commission_estimated: dinheiro,
  channel: z.string(),
  content_id: z.string().nullable(),
  line_no: z.number().int(),
});

export type LinhaPedido = z.infer<typeof linhaPedido>;
export type LinhaSku = z.infer<typeof linhaSku>;

export async function contar(p: Periodo, f: FiltroPedidos) {
  const [linha] = await many(
    z.object({ total: z.number().int() }),
    sql`select count(*)::int as total from orders o ${onde(p, f)}`,
  );
  return linha!.total;
}

/**
 * Página de pedidos. Aceita offset (o `page` do contrato) ou cursor, que é o
 * que aguenta lista grande: o offset fica caro quando a página é alta.
 */
export function listar(
  p: Periodo,
  f: FiltroPedidos,
  pagina: { limite: number; offset: number; cursor?: { createdAt: Date; id: string } },
) {
  const depoisDoCursor = pagina.cursor
    ? sql`and (o.created_at, o.id) < (${pagina.cursor.createdAt}, ${pagina.cursor.id})`
    : sql``;
  return many(
    linhaPedido,
    sql`select o.id, o.created_at, o.delivered_at, o.status::text as status, o.currency,
               o.source::text as source, o.source_at
          from orders o
          ${onde(p, f)} ${depoisDoCursor}
         order by o.created_at desc, o.id desc
         limit ${pagina.limite} offset ${pagina.cursor ? 0 : pagina.offset}`,
  );
}

export function itensDosPedidos(accountId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([] as LinhaSku[]);
  return many(
    linhaSku,
    sql`select order_id, id, product_id, name, shop_name, unit_price, quantity,
               returned_quantity, refunded_quantity, gmv, commission_base_actual,
               commission_rate, rate_standard, rate_shop_ads, rate_bonus, rate_reward,
               commission_estimated, commission_settled, shop_ads_commission_estimated,
               channel::text as channel, content_id, line_no
          from order_skus
         where account_id = ${accountId} and order_id in ${sql(ids)}
         order by order_id, line_no`,
  );
}

/** Busca o pedido em qualquer conta da pessoa: o contrato não manda accountId. */
export async function buscarPorId(userId: string, id: string) {
  const [linha] = await many(
    linhaPedido.extend({ account_id: z.guid() }),
    sql`select o.account_id, o.id, o.created_at, o.delivered_at, o.status::text as status,
               o.currency, o.source::text as source, o.source_at
          from orders o
          join provider_connections c on c.id = o.account_id
         where o.id = ${id} and c.user_id = ${userId}
         limit 1`,
  );
  return linha ?? null;
}

export function historico(accountId: string, orderId: string) {
  return many(
    z.object({ status: z.string(), at: z.date() }),
    sql`select status::text as status, at from order_status_history
         where account_id = ${accountId} and order_id = ${orderId}
         order by at, status`,
  );
}
