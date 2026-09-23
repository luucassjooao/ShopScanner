import { z } from 'zod';

/**
 * Schemas do contrato com o backend (CLAUDE.md → "Contrato com o backend" e "Tipos do contrato").
 * Dinheiro é texto decimal; taxa é inteiro em centésimos de %; data é ISO 8601 em UTC.
 */

/** `"11378.50"`: texto decimal, nunca número. */
export const money = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'dinheiro precisa ser texto decimal, ex.: "11378.50"');
export type Money = z.infer<typeof money>;

/** `1500` = 15%. Inteiro, igual ao TikTok. */
export const rate = z.number().int();
export type Rate = z.infer<typeof rate>;

export const iso = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'data precisa ser ISO 8601');

/** `"2026-09-22"`: dia do calendário, sem hora. */
export const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** `"2026-09"` */
export const mes = z.string().regex(/^\d{4}-\d{2}$/);

export const orderStatus = z.enum([
  'AWAITING_PAYMENT',
  'TO_SETTLE',
  'SETTLED',
  'REFUNDED',
  'FROZEN',
]);
export type OrderStatus = z.infer<typeof orderStatus>;

export const channel = z.enum(['VIDEO', 'LIVE', 'PRE_LIVE', 'SHOP', 'LINKSHARE', 'PROMOTION_PAGE']);
export type Channel = z.infer<typeof channel>;

const paginado = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int(), page: z.number().int() });

// --- auth e contas ---

export const usuario = z.object({ id: z.string(), name: z.string(), email: z.string() });
export type Usuario = z.infer<typeof usuario>;

export const conta = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  shopConnected: z.boolean(),
  connectedAt: iso,
});
export type Conta = z.infer<typeof conta>;

export const sessao = z.object({ user: usuario, accounts: z.array(conta) });
export type Sessao = z.infer<typeof sessao>;

export const loginInput = z.object({ email: z.email(), password: z.string().min(1) });
export type LoginInput = z.infer<typeof loginInput>;

export const registerInput = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  acceptedTermsVersion: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const forgotPasswordInput = z.object({ email: z.email() });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>;

export const contas = z.array(conta);
export const conexaoTiktok = z.object({ authorizeUrl: z.string() });

// --- pedidos ---

export const orderSku = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  shopName: z.string(),
  unitPrice: money,
  quantity: z.number().int(),
  returnedQuantity: z.number().int(),
  refundedQuantity: z.number().int(),
  gmv: money,
  commissionBaseActual: money.nullable(),
  commissionRate: rate,
  rates: z.object({ standard: rate, shopAds: rate, bonus: rate, reward: rate }),
  commissionEstimated: money,
  commissionSettled: money.nullable(),
  shopAdsCommissionEstimated: money,
  channel,
  contentId: z.string().nullable(),
});
export type OrderSku = z.infer<typeof orderSku>;

export const order = z.object({
  id: z.string(),
  createdAt: iso,
  deliveredAt: iso.nullable(),
  status: orderStatus,
  currency: z.string().length(3),
  skus: z.array(orderSku),
});
export type Order = z.infer<typeof order>;

export const orderDetail = order.extend({
  statusHistory: z.array(z.object({ status: orderStatus, at: iso })),
});
export type OrderDetail = z.infer<typeof orderDetail>;

export const ordersPage = paginado(order);
export type OrdersPage = z.infer<typeof ordersPage>;

// --- resumo ---

export const summary = z.object({
  gmv: money,
  commissionEstimated: money,
  commissionToReceive: money,
  commissionSettled: money,
  unitsSold: z.number().int(),
  ordersCount: z.number().int(),
  avgTicket: money,
  goal: z.object({ gmv: money.nullable(), commission: money.nullable() }).nullable(),
  byDay: z.array(z.object({ date: dia, gmv: money, commission: money })),
  byStatus: z.array(z.object({ status: orderStatus, gmv: money })),
  byChannel: z.array(z.object({ channel, gmv: money })),
  topProducts: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      shopName: z.string(),
      gmv: money,
      commission: money,
      units: z.number().int(),
    }),
  ),
});
export type Summary = z.infer<typeof summary>;

// --- vídeos ---

export const video = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  postedAt: iso,
  duration: z.number().int(),
  coverUrl: z.string().nullable(),
  shareUrl: z.string().nullable(),
  views: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
  shares: z.number().int(),
  // Nulos sem o TikTok Shop conectado: "ainda não disponível", nunca zero.
  gmv: money.nullable(),
  commission: money.nullable(),
  gpm: money.nullable(),
});
export type Video = z.infer<typeof video>;

export const videosPage = z.object({ items: z.array(video), total: z.number().int() });
export type VideosPage = z.infer<typeof videosPage>;

export const videoDetail = video.extend({
  snapshots: z.array(z.object({ at: iso, views: z.number().int(), likes: z.number().int() })),
});
export type VideoDetail = z.infer<typeof videoDetail>;

// --- produtos ---

export const productRow = z.object({
  productId: z.string(),
  name: z.string(),
  shopName: z.string(),
  imageUrl: z.string().nullable(),
  gmv: money,
  commission: money,
  commissionRate: rate,
  units: z.number().int(),
  refundedUnits: z.number().int(),
  ordersCount: z.number().int(),
  topChannel: channel.nullable(),
});
export type ProductRow = z.infer<typeof productRow>;

export const productsPage = paginado(productRow);
export type ProductsPage = z.infer<typeof productsPage>;

export const productDetail = productRow.extend({
  detailUrl: z.string().nullable(),
  videos: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      coverUrl: z.string().nullable(),
      postedAt: iso,
      views: z.number().int().nullable(),
      gmv: money.nullable(),
      units: z.number().int().nullable(),
    }),
  ),
});
export type ProductDetail = z.infer<typeof productDetail>;

// --- planejamento e metas ---

export const planStatus = z.enum(['IDEA', 'SCRIPT', 'RECORDED', 'EDITED', 'POSTED']);
export type PlanStatus = z.infer<typeof planStatus>;

export const planScript = z.object({
  hook: z.string(),
  scene1: z.string(),
  scene2: z.string(),
  cta: z.string(),
  caption: z.string(),
});

export const plan = z.object({
  id: z.string(),
  title: z.string(),
  productId: z.string().nullable(),
  scheduledFor: iso.nullable(),
  status: planStatus,
  videoId: z.string().nullable(),
  script: planScript.nullable(),
  notes: z.string().nullable(),
  createdAt: iso,
  updatedAt: iso,
});
export type Plan = z.infer<typeof plan>;

export const plans = z.array(plan);

/** Corpo do POST /plans; o PATCH aceita qualquer parte dele. */
export const planInput = plan.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  title: z.string().min(1),
});
export type PlanInput = z.infer<typeof planInput>;

export const goal = z.object({
  accountId: z.string(),
  month: mes,
  gmv: money.nullable(),
  commission: money.nullable(),
});
export type Goal = z.infer<typeof goal>;

export const goals = z.array(goal);

// --- preferências de aviso ---

export const notificationSettings = z.object({
  orderFrozen: z.boolean(),
  orderRefunded: z.boolean(),
  goalReached: z.boolean(),
  paceDrop: z.boolean(),
  postReminder: z.boolean(),
  // e-mail existe no contrato, mas fica false no MVP: não há backend enviando.
  channels: z.object({ inApp: z.boolean(), email: z.boolean() }),
});
export type NotificationSettings = z.infer<typeof notificationSettings>;

/** GET /me/export: arquivo JSON com todos os dados; o front só repassa para download. */
export const exportData = z.unknown();
