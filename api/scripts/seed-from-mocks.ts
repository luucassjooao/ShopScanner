import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from '../src/lib/db.ts';

/**
 * Carrega os JSONs de `mocks/` (formato cru da API do TikTok) no banco de
 * desenvolvimento, com o **mesmo mapeamento do adaptador do front**
 * (`web/src/mocks/adapters/tiktok.ts`). Os dois lados precisam chegar aos
 * mesmos totais de referência; se divergirem, um dos dois está errado.
 *
 * Idempotente: tudo entra por upsert, então rodar duas vezes não duplica.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTA = '00000000-0000-0000-0000-0000000000a1';

/** Data do relatório que os mocks representam. Fixa, igual ao do front. */
const LIDO_EM = new Date('2026-10-01T09:00:00.000Z');

const STATUS: Record<string, string> = {
  'AWAITING PAYMENT': 'AWAITING_PAYMENT',
  'To-SETTLE': 'TO_SETTLE',
  SETTLED: 'SETTLED',
  REFUNDED: 'REFUNDED',
  FROZEN: 'FROZEN',
};

/** Dinheiro em centavos inteiros: nunca float. */
function toCents(v: string): bigint {
  const negativo = v.startsWith('-');
  const [inteiro = '0', decimal = ''] = v.replace('-', '').split('.');
  const cents = BigInt(inteiro) * 100n + BigInt((decimal + '00').slice(0, 2));
  return negativo ? -cents : cents;
}

function fromCents(c: bigint): string {
  const negativo = c < 0n;
  const abs = negativo ? -c : c;
  return `${negativo ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

const unix = (s: number) => new Date(s * 1000);

async function ler<T>(arquivo: string): Promise<T> {
  return JSON.parse(await readFile(join(RAIZ, 'mocks', arquivo), 'utf8'));
}

type RawMoney = { amount: string; currency: string };
type RawSku = {
  id: string;
  product_id: string;
  product_name: string;
  shop_name: string;
  price: RawMoney;
  quantity: number;
  returned_quantity: number;
  refunded_quantity: number;
  commission_rate: number;
  shop_ads_commission_rate: number;
  commission_bonus_rate: number;
  creator_commission_reward_rate: number;
  estimated_commission: RawMoney;
  estimated_shop_ads_commission: RawMoney;
  actual_commission: RawMoney;
  actual_commission_base: RawMoney;
  content_id: string;
  content_type: string;
};
type RawOrder = {
  id: string;
  create_time: number;
  delivery_time: number;
  status: string;
  skus: RawSku[];
};
type RawVideo = {
  id: string;
  create_time: number;
  cover_image_url?: string;
  share_url?: string;
  video_description?: string;
  duration: number;
  title?: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
};
type RawProduct = {
  id: string;
  title?: string;
  product_name?: string;
  shop_name?: string;
  detail_link?: string;
  main_images?: { url: string }[];
};

async function conferirConta() {
  const [conta] = await sql`select id from provider_connections where id = ${CONTA}`;
  if (!conta) {
    throw new Error('Conta de demonstração não existe. Rode `npm run db:seed` antes.');
  }
}

async function carregarPedidos() {
  const json = await ler<{ data: { orders: RawOrder[] } }>(
    'search_creator_affiliate_orders_202410.json',
  );

  const pedidos = [];
  const itens = [];
  const historico = [];

  for (const bruto of json.data.orders) {
    const status = STATUS[bruto.status];
    if (!status) throw new Error(`Status do TikTok desconhecido: ${bruto.status}`);
    const criadoEm = unix(bruto.create_time);
    const entregueEm = bruto.delivery_time ? unix(bruto.delivery_time) : null;

    pedidos.push({
      account_id: CONTA,
      id: bruto.id,
      created_at: criadoEm,
      delivered_at: entregueEm,
      status,
      currency: bruto.skus[0]?.price.currency ?? 'BRL',
      source: 'FILE',
      source_at: LIDO_EM,
    });

    // A origem não tem datas de transição: o histórico é aproximado, igual ao
    // do front, e vira dado de verdade quando a sincronização existir.
    historico.push({
      account_id: CONTA,
      order_id: bruto.id,
      status: 'AWAITING_PAYMENT',
      at: criadoEm,
    });
    if (status !== 'AWAITING_PAYMENT') {
      historico.push({
        account_id: CONTA,
        order_id: bruto.id,
        status,
        at: entregueEm ?? criadoEm,
      });
    }

    for (const [posicao, sku] of bruto.skus.entries()) {
      const liquidado = status === 'SETTLED';
      const shopAds = sku.shop_ads_commission_rate;
      const bonus = sku.commission_bonus_rate;
      const reward = sku.creator_commission_reward_rate;
      itens.push({
        account_id: CONTA,
        order_id: bruto.id,
        line_no: posicao,
        id: sku.id,
        product_id: sku.product_id,
        name: sku.product_name,
        shop_name: sku.shop_name,
        unit_price: sku.price.amount,
        quantity: sku.quantity,
        returned_quantity: sku.returned_quantity,
        refunded_quantity: sku.refunded_quantity,
        // Não existe "gmv" na origem: preço × quantidade.
        gmv: fromCents(toCents(sku.price.amount) * BigInt(sku.quantity)),
        // `actual_*` só vale em SETTLED; nos outros vem "0.00", que não é zero.
        commission_base_actual: liquidado ? sku.actual_commission_base.amount : null,
        commission_settled: liquidado ? sku.actual_commission.amount : null,
        commission_rate: sku.commission_rate,
        rate_standard: sku.commission_rate - shopAds - bonus - reward,
        rate_shop_ads: shopAds,
        rate_bonus: bonus,
        rate_reward: reward,
        commission_estimated: sku.estimated_commission.amount,
        shop_ads_commission_estimated: sku.estimated_shop_ads_commission.amount,
        channel: sku.content_type,
        content_id: sku.content_id || null,
      });
    }
  }

  await sql`insert into orders ${sql(pedidos)}
            on conflict (account_id, id) do update set
              created_at = excluded.created_at, delivered_at = excluded.delivered_at,
              status = excluded.status, currency = excluded.currency,
              source = excluded.source, source_at = excluded.source_at`;

  await sql`insert into order_skus ${sql(itens)}
            on conflict (account_id, order_id, line_no) do update set
              id = excluded.id, product_id = excluded.product_id, name = excluded.name,
              shop_name = excluded.shop_name, unit_price = excluded.unit_price,
              quantity = excluded.quantity, returned_quantity = excluded.returned_quantity,
              refunded_quantity = excluded.refunded_quantity, gmv = excluded.gmv,
              commission_base_actual = excluded.commission_base_actual,
              commission_rate = excluded.commission_rate,
              rate_standard = excluded.rate_standard, rate_shop_ads = excluded.rate_shop_ads,
              rate_bonus = excluded.rate_bonus, rate_reward = excluded.rate_reward,
              commission_estimated = excluded.commission_estimated,
              commission_settled = excluded.commission_settled,
              shop_ads_commission_estimated = excluded.shop_ads_commission_estimated,
              channel = excluded.channel, content_id = excluded.content_id`;

  await sql`insert into order_status_history ${sql(historico)}
            on conflict (account_id, order_id, status, at) do nothing`;

  return { pedidos: pedidos.length, itens: itens.length };
}

async function carregarVideos() {
  const json = await ler<{ data: { videos: RawVideo[] } }>('display_api_video_list_v2.json');
  const videos = json.data.videos.map((v) => ({
    account_id: CONTA,
    id: v.id,
    title: v.title ?? '',
    description: v.video_description ?? '',
    posted_at: unix(v.create_time),
    duration: v.duration,
    cover_url: v.cover_image_url || null,
    share_url: v.share_url || null,
    views: v.view_count,
    likes: v.like_count,
    comments: v.comment_count,
    shares: v.share_count,
  }));

  await sql`insert into videos ${sql(videos)}
            on conflict (account_id, id) do update set
              title = excluded.title, description = excluded.description,
              posted_at = excluded.posted_at, duration = excluded.duration,
              cover_url = excluded.cover_url, share_url = excluded.share_url,
              views = excluded.views, likes = excluded.likes,
              comments = excluded.comments, shares = excluded.shares`;

  // Views na origem são total acumulado. A leitura que temos é uma só, então
  // a série começa com um ponto — não vale inventar os outros.
  await sql`insert into video_snapshots ${sql(
    videos.map((v) => ({
      account_id: CONTA,
      video_id: v.id,
      at: LIDO_EM,
      views: v.views,
      likes: v.likes,
    })),
  )} on conflict (account_id, video_id, at) do update set
       views = excluded.views, likes = excluded.likes`;

  return videos.length;
}

async function carregarCatalogo() {
  const json = await ler<{ data: { products: RawProduct[] } }>('get_showcase_products_202405.json');
  const produtos = json.data.products.map((p) => ({
    account_id: CONTA,
    id: p.id,
    name: p.title ?? p.product_name ?? null,
    shop_name: p.shop_name ?? null,
    image_url: p.main_images?.[0]?.url ?? null,
    detail_url: p.detail_link || null,
  }));
  if (produtos.length === 0) return 0;

  await sql`insert into products ${sql(produtos)}
            on conflict (account_id, id) do update set
              name = excluded.name, shop_name = excluded.shop_name,
              image_url = excluded.image_url, detail_url = excluded.detail_url`;
  return produtos.length;
}

await conferirConta();
const { pedidos, itens } = await carregarPedidos();
const videos = await carregarVideos();
const produtos = await carregarCatalogo();
console.log(
  `mocks carregados: ${pedidos} pedidos, ${itens} itens, ${videos} vídeos, ${produtos} produtos de catálogo.`,
);
await sql.end();
