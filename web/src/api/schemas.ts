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
  // Só existe quando `source` é FILE: é o rótulo que a creator vê no app do TikTok.
  'INELIGIBLE',
]);
export type OrderStatus = z.infer<typeof orderStatus>;

/** De onde veio o registro: API do TikTok, arquivo importado ou dedução nossa. */
export const source = z.enum(['API', 'FILE', 'ESTIMATED']);
export type Source = z.infer<typeof source>;

export const channel = z.enum(['VIDEO', 'LIVE', 'PRE_LIVE', 'SHOP', 'LINKSHARE', 'PROMOTION_PAGE']);
export type Channel = z.infer<typeof channel>;

const paginado = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int(), page: z.number().int() });

// --- auth e contas ---

export const usuario = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  /** Falso quando a conta nasceu pelo Google e nunca definiu senha. */
  hasPassword: z.boolean(),
  identities: z.array(
    z.object({ provider: z.literal('GOOGLE'), email: z.string(), linkedAt: iso }),
  ),
  /** Null em conta criada pelo Google: o aceite é pedido depois do primeiro acesso. */
  acceptedTermsVersion: z.string().nullable(),
});
export type Usuario = z.infer<typeof usuario>;

export const conta = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  shopConnected: z.boolean(),
  /** Existe pedido nesta conta, de qualquer fonte (API ou arquivo). Não depende de Shop conectado. */
  hasSales: z.boolean(),
  connectedAt: iso,
  /** Última leitura feita pelo backend; null antes da primeira sincronização. */
  lastSyncedAt: iso.nullable(),
  /** Quando a autorização do TikTok vence; passou disso, é preciso reconectar. */
  expiresAt: iso.nullable(),
});
export type Conta = z.infer<typeof conta>;

export const sessao = z.object({ user: usuario, accounts: z.array(conta) });
export type Sessao = z.infer<typeof sessao>;

export const loginInput = z.object({ email: z.email(), password: z.string().min(1) });
export type LoginInput = z.infer<typeof loginInput>;

export const registerInput = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(8),
  acceptedTermsVersion: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const forgotPasswordInput = z.object({ email: z.email() });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>;

export const contas = z.array(conta);
export const conexaoTiktok = z.object({ authorizeUrl: z.string() });

export const perfilInput = z
  .object({
    name: z.string().trim().min(2),
    email: z.email(),
    /** Aceite de quem criou a conta pelo Google, pedido depois do primeiro acesso. */
    acceptedTermsVersion: z.string().min(1),
  })
  .partial();
export type PerfilInput = z.infer<typeof perfilInput>;

export const senhaInput = z.object({
  // Ausente só quando a conta ainda não tem senha (nasceu pelo Google): é a primeira senha.
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8),
});
export type SenhaInput = z.infer<typeof senhaInput>;

export const avatarResposta = z.object({ avatarUrl: z.string() });
export const importResposta = z.object({ importId: z.string() });

/** Códigos de erro de import. Cada um tem orientação própria em `lib/import.ts`. */
export const importErroCodigo = z.enum([
  'WRONG_EXTENSION',
  'TOO_LARGE',
  'NO_HEADER',
  'UNKNOWN_COLUMNS',
  'WRONG_CURRENCY',
  'WRONG_FILE',
  'FAILED',
]);
export type ImportErroCodigo = z.infer<typeof importErroCodigo>;

export const importBatch = z.object({
  id: z.string(),
  accountId: z.string(),
  kind: z.enum(['FILE', 'SYNC', 'RECHECK']),
  fileName: z.string().nullable(),
  createdAt: iso,
  status: z.enum(['QUEUED', 'PROCESSING', 'DONE', 'FAILED']),
  result: z
    .object({
      created: z.number().int(),
      updated: z.number().int(),
      unchanged: z.number().int(),
      skipped: z.number().int(),
    })
    .nullable(),
  error: z
    .object({
      code: importErroCodigo,
      message: z.string(),
      columnsFound: z.array(z.string()).optional(),
      columnsMissing: z.array(z.string()).optional(),
    })
    .nullable(),
});
export type ImportBatch = z.infer<typeof importBatch>;
export const importsPage = paginado(importBatch);

/** Divergência entre o arquivo e a API para o mesmo pedido. A API sempre prevalece. */
export const reconciliacaoLinha = z.object({
  orderId: z.string(),
  skuId: z.string(),
  field: z.string(),
  fromFile: z.string().nullable(),
  fromApi: z.string().nullable(),
  resolvedWith: source,
  at: iso,
});
export type ReconciliacaoLinha = z.infer<typeof reconciliacaoLinha>;
export const reconciliacao = z.array(reconciliacaoLinha);

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
  source,
  /** Quando essa fonte leu o dado. */
  sourceAt: iso,
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
  /** Só `TO_SETTLE` e `SETTLED`: é o que a creator vê no app do TikTok. */
  gmvEligible: money,
  /** Aguardando pagamento, inelegível, reembolsado e retido. */
  gmvIneligible: money,
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
  orderSettled: z.boolean(),
  orderFrozen: z.boolean(),
  orderRefunded: z.boolean(),
  /** Meta do mês: dispara em 80% e em 100%. */
  goalReached: z.boolean(),
  paceDrop: z.boolean(),
  viewsDrop: z.boolean(),
  postReminder: z.boolean(),
  // e-mail existe no contrato, mas fica false no MVP: não há backend enviando.
  channels: z.object({ inApp: z.boolean(), email: z.boolean() }),
});
export type NotificationSettings = z.infer<typeof notificationSettings>;

/** GET /me/export: arquivo JSON com todos os dados; o front só repassa para download. */
export const exportData = z.unknown();
