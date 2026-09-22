import type {
  Conta,
  Order,
  OrderDetail,
  OrderSku,
  OrderStatus,
  Channel,
  ProductDetail,
  ProductRow,
  Video,
} from '@/api/schemas';
import { divRound, fromCents, toCents } from '@/lib/money';
import { productRows } from '@/lib/metrics';
import ordersJson from '../../../../mocks/search_creator_affiliate_orders_202410.json';
import videosJson from '../../../../mocks/display_api_video_list_v2.json';
import showcaseJson from '../../../../mocks/get_showcase_products_202405.json';
import profileJson from '../../../../mocks/get_creator_profile_202508.json';

/**
 * Único lugar do front que conhece o formato cru da API do TikTok (CLAUDE.md).
 * Faz aqui o que o backend fará lá: normaliza status, troca Unix por ISO, `""` e `0` por null,
 * e entrega dinheiro como texto decimal.
 */

// --- formato cru (só os campos lidos) ---

interface RawMoney {
  amount: string;
  currency: string;
}

export interface RawSku {
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
}

export interface RawOrder {
  id: string;
  create_time: number;
  delivery_time: number;
  status: string;
  skus: RawSku[];
}

interface RawVideo {
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
}

interface RawShowcaseProduct {
  id: string;
  detail_link?: string;
  main_images?: { url: string }[];
}

// --- conversões ---

const STATUS: Record<string, OrderStatus> = {
  'AWAITING PAYMENT': 'AWAITING_PAYMENT',
  'To-SETTLE': 'TO_SETTLE',
  SETTLED: 'SETTLED',
  REFUNDED: 'REFUNDED',
  FROZEN: 'FROZEN',
};

const CHANNELS: Channel[] = ['VIDEO', 'LIVE', 'PRE_LIVE', 'SHOP', 'LINKSHARE', 'PROMOTION_PAGE'];

function status(raw: string): OrderStatus {
  const s = STATUS[raw];
  if (!s) throw new Error(`Status do TikTok desconhecido: ${raw}`);
  return s;
}

function channel(raw: string): Channel {
  if (!CHANNELS.includes(raw as Channel)) throw new Error(`Canal do TikTok desconhecido: ${raw}`);
  return raw as Channel;
}

const unixToIso = (s: number) => new Date(s * 1000).toISOString();

export function adaptSku(raw: RawSku, orderStatus: OrderStatus): OrderSku {
  const settled = orderStatus === 'SETTLED';
  const shopAds = raw.shop_ads_commission_rate;
  const bonus = raw.commission_bonus_rate;
  const reward = raw.creator_commission_reward_rate;
  return {
    id: raw.id,
    productId: raw.product_id,
    name: raw.product_name,
    shopName: raw.shop_name,
    unitPrice: raw.price.amount,
    quantity: raw.quantity,
    returnedQuantity: raw.returned_quantity,
    refundedQuantity: raw.refunded_quantity,
    // Não existe "gmv" na origem: preço × quantidade (= estimated_commission_base).
    gmv: fromCents(toCents(raw.price.amount) * BigInt(raw.quantity)),
    // `actual_*` só vale em SETTLED; nos outros status vem "0.00", que não é zero de verdade.
    commissionBaseActual: settled ? raw.actual_commission_base.amount : null,
    commissionSettled: settled ? raw.actual_commission.amount : null,
    commissionRate: raw.commission_rate,
    // A origem não traz a taxa padrão separada; o backend a entrega pronta.
    rates: { standard: raw.commission_rate - shopAds - bonus - reward, shopAds, bonus, reward },
    commissionEstimated: raw.estimated_commission.amount,
    shopAdsCommissionEstimated: raw.estimated_shop_ads_commission.amount,
    channel: channel(raw.content_type),
    contentId: raw.content_id || null,
  };
}

export function adaptOrder(raw: RawOrder): Order {
  const s = status(raw.status);
  return {
    id: raw.id,
    createdAt: unixToIso(raw.create_time),
    deliveredAt: raw.delivery_time ? unixToIso(raw.delivery_time) : null,
    status: s,
    currency: raw.skus[0]?.price.currency ?? 'BRL',
    skus: raw.skus.map((sku) => adaptSku(sku, s)),
  };
}

/**
 * A origem não tem datas de transição de status; o backend vai guardá-las ao sincronizar.
 * ponytail: histórico aproximado (criação → status atual na entrega ou na criação).
 */
export function orderDetail(order: Order): OrderDetail {
  const statusHistory: OrderDetail['statusHistory'] = [
    { status: 'AWAITING_PAYMENT', at: order.createdAt },
  ];
  if (order.status !== 'AWAITING_PAYMENT') {
    statusHistory.push({ status: order.status, at: order.deliveredAt ?? order.createdAt });
  }
  return { ...order, statusHistory };
}

/**
 * SUPOSIÇÃO NÃO CONFIRMADA (CLAUDE.md): `content_id` de pedido VIDEO = `id` da Display API.
 * Toda análise por vídeo passa por esta função e só por ela.
 */
export function skusDoVideo(videoId: string, orders: Order[]): OrderSku[] {
  return orders.flatMap((o) =>
    o.skus.filter((sku) => sku.channel === 'VIDEO' && sku.contentId === videoId),
  );
}

export function adaptVideo(raw: RawVideo, orders: Order[] | null): Video {
  const base = {
    id: raw.id,
    title: raw.title ?? '',
    description: raw.video_description ?? '',
    postedAt: unixToIso(raw.create_time),
    duration: raw.duration,
    coverUrl: raw.cover_image_url || null,
    shareUrl: raw.share_url || null,
    views: raw.view_count,
    likes: raw.like_count,
    comments: raw.comment_count,
    shares: raw.share_count,
  };
  // Sem TikTok Shop conectado: "ainda não disponível", nunca zero.
  if (!orders) return { ...base, gmv: null, commission: null, gpm: null };
  const skus = skusDoVideo(raw.id, orders);
  const gmv = skus.reduce((t, s) => t + toCents(s.gmv), 0n);
  const commission = skus.reduce((t, s) => t + toCents(s.commissionEstimated), 0n);
  return {
    ...base,
    gmv: fromCents(gmv),
    commission: fromCents(commission),
    // GPM: GMV por mil views.
    gpm: raw.view_count ? fromCents(divRound(gmv * 1000n, BigInt(raw.view_count))) : null,
  };
}

const showcase = new Map(
  (showcaseJson.data.products as RawShowcaseProduct[]).map((p) => [p.id, p]),
);

/** Completa a linha com a imagem da vitrine (produto fora dela fica sem imagem). */
export function withCatalog(row: ProductRow): ProductRow {
  return { ...row, imageUrl: showcase.get(row.productId)?.main_images?.[0]?.url ?? null };
}

export function productDetail(
  productId: string,
  orders: Order[],
  videos: Video[],
): ProductDetail | null {
  const row = productRows(orders.filter((o) => o.skus.some((s) => s.productId === productId))).find(
    (r) => r.productId === productId,
  );
  if (!row) return null;
  const promovidos = videos.flatMap((v) => {
    const skus = skusDoVideo(v.id, orders).filter((s) => s.productId === productId);
    if (!skus.length) return [];
    return [
      {
        id: v.id,
        title: v.title,
        coverUrl: v.coverUrl,
        postedAt: v.postedAt,
        views: v.views,
        gmv: fromCents(skus.reduce((t, s) => t + toCents(s.gmv), 0n)),
        units: skus.reduce((t, s) => t + s.quantity, 0),
      },
    ];
  });
  return {
    ...withCatalog(row),
    detailUrl: showcase.get(productId)?.detail_link || null,
    videos: promovidos,
  };
}

// --- dados da conta demo ---

export const orders: Order[] = (ordersJson.data.orders as RawOrder[]).map(adaptOrder);
export const rawVideos = videosJson.data.videos as RawVideo[];

export const profile = {
  username: `@${profileJson.data.username}`,
  avatarUrl: profileJson.data.avatar?.url ?? null,
} satisfies Pick<Conta, 'username' | 'avatarUrl'>;
