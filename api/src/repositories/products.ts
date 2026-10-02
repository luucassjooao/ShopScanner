import { z } from 'zod';
import { many, sql } from '../lib/db.ts';
import type { Periodo } from './orders.ts';

const dinheiro = z.string();

const linhaProduto = z.object({
  product_id: z.string(),
  name: z.string(),
  shop_name: z.string(),
  image_url: z.string().nullable(),
  gmv: dinheiro,
  commission: dinheiro,
  commission_rate: z.number().int(),
  units: z.number().int(),
  refunded_units: z.number().int(),
  orders_count: z.number().int(),
  top_channel: z.string().nullable(),
});

export type LinhaProduto = z.infer<typeof linhaProduto>;
export type OrdemProdutos = 'gmv' | 'commission' | 'units' | 'refunds';

function ordenar(ordem: OrdemProdutos) {
  if (ordem === 'commission') return sql`order by commission desc, product_id`;
  if (ordem === 'units') return sql`order by units desc, product_id`;
  if (ordem === 'refunds') return sql`order by refunded_units desc, product_id`;
  return sql`order by gmv desc, product_id`;
}

function onde(p: Periodo, f: { shopName?: string; q?: string }) {
  return sql`where s.account_id = ${p.accountId}
               and o.created_at between ${p.from} and ${p.to}
               ${f.shopName ? sql`and s.shop_name = ${f.shopName}` : sql``}
               ${
                 f.q
                   ? sql`and (s.name ilike ${`%${f.q}%`} or s.shop_name ilike ${`%${f.q}%`})`
                   : sql``
               }`;
}

/**
 * Linha de produto é agregação dos itens vendidos; imagem e link vêm do
 * catálogo, que a venda não carrega. Nome, loja e taxa são os do pedido mais
 * recente — taxa muda com o tempo e a vigente é a que interessa.
 */
export function listar(
  p: Periodo,
  f: { shopName?: string; q?: string },
  pagina: { ordem: OrdemProdutos; limite: number; offset: number },
) {
  return many(
    linhaProduto,
    sql`with por_canal as (
          select s.product_id, s.channel,
                 row_number() over (partition by s.product_id
                                    order by sum(s.gmv) desc, s.channel) as pos
            from order_skus s
            join orders o on o.account_id = s.account_id and o.id = s.order_id
            ${onde(p, f)}
           group by s.product_id, s.channel
        ),
        agregado as (
          select s.product_id,
                 (array_agg(s.name order by o.created_at desc))[1] as name,
                 (array_agg(s.shop_name order by o.created_at desc))[1] as shop_name,
                 (array_agg(s.commission_rate order by o.created_at desc))[1] as commission_rate,
                 sum(s.gmv)::numeric(18,2) as gmv,
                 sum(s.commission_estimated)::numeric(18,2) as commission,
                 sum(s.quantity)::int as units,
                 sum(s.refunded_quantity)::int as refunded_units,
                 count(distinct s.order_id)::int as orders_count
            from order_skus s
            join orders o on o.account_id = s.account_id and o.id = s.order_id
            ${onde(p, f)}
           group by s.product_id
        )
        select a.*, p.image_url, c.channel::text as top_channel
          from agregado a
          left join products p on p.account_id = ${p.accountId} and p.id = a.product_id
          left join por_canal c on c.product_id = a.product_id and c.pos = 1
         ${ordenar(pagina.ordem)}
         limit ${pagina.limite} offset ${pagina.offset}`,
  );
}

export async function contar(p: Periodo, f: { shopName?: string; q?: string }) {
  const [linha] = await many(
    z.object({ total: z.number().int() }),
    sql`select count(distinct s.product_id)::int as total
          from order_skus s
          join orders o on o.account_id = s.account_id and o.id = s.order_id
          ${onde(p, f)}`,
  );
  return linha!.total;
}

/** Detalhe não recorta período: é a vida inteira do produto naquela conta. */
export async function buscarPorId(userId: string, productId: string) {
  const [conta] = await many(
    z.object({ account_id: z.guid() }),
    sql`select distinct s.account_id
          from order_skus s
          join provider_connections c on c.id = s.account_id
         where s.product_id = ${productId} and c.user_id = ${userId}
         limit 1`,
  );
  if (!conta) return null;

  const periodo: Periodo = {
    accountId: conta.account_id,
    from: new Date(0),
    to: new Date('2100-01-01T00:00:00Z'),
  };
  const [linha] = await listar(periodo, {}, { ordem: 'gmv', limite: 1, offset: 0 }).then((linhas) =>
    linhas.filter((l) => l.product_id === productId),
  );

  // O produto pode existir no catálogo sem venda no recorte do `listar`.
  if (!linha) return null;
  const [catalogo] = await many(
    z.object({ detail_url: z.string().nullable() }),
    sql`select detail_url from products
         where account_id = ${conta.account_id} and id = ${productId}`,
  );
  return {
    accountId: conta.account_id,
    linha,
    detailUrl: catalogo?.detail_url ?? null,
  };
}

/** Vídeos que promoveram o produto, pela mesma suposição de `content_id`. */
export function videosDoProduto(accountId: string, productId: string) {
  return many(
    z.object({
      id: z.string(),
      title: z.string(),
      cover_url: z.string().nullable(),
      posted_at: z.date(),
      views: z.number().int().nullable(),
      gmv: dinheiro,
      units: z.number().int(),
    }),
    sql`select v.id, v.title, v.cover_url, v.posted_at, v.views::int as views,
               sum(s.gmv)::numeric(18,2) as gmv, sum(s.quantity)::int as units
          from order_skus s
          join videos v on v.account_id = s.account_id and v.id = s.content_id
         where s.account_id = ${accountId} and s.product_id = ${productId}
           and s.channel = 'VIDEO'
         group by v.id, v.title, v.cover_url, v.posted_at, v.views
         order by sum(s.gmv) desc, v.id`,
  );
}
