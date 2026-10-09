import { AppError } from '../lib/errors.ts';
import * as conexoes from '../repositories/connections.ts';
import * as pedidos from '../repositories/orders.ts';
import type { FiltroPedidos, LinhaPedido, LinhaSku, Periodo } from '../repositories/orders.ts';
import * as planejamento from '../repositories/planning.ts';
import * as produtos from '../repositories/products.ts';
import type { LinhaProduto, OrdemProdutos } from '../repositories/products.ts';
import * as videos from '../repositories/videos.ts';
import type { LinhaVideo, OrdemVideos } from '../repositories/videos.ts';

/** Conta que não é da pessoa não existe: 404, nunca 403 com detalhe. */
export async function conferirConta(userId: string, accountId: string) {
  const conta = await conexoes.buscarConta(userId, accountId);
  if (!conta) throw AppError.naoEncontrado('Conta não encontrada');
  return conta;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

/* ------------------------------------------------------------------ resumo */

export async function resumo(p: Periodo) {
  const [totais, byDay, byStatus, byChannel, topProducts, meta] = await Promise.all([
    pedidos.totais(p),
    pedidos.porDia(p),
    pedidos.porStatus(p),
    pedidos.porCanal(p),
    pedidos.maioresProdutos(p),
    planejamento.metaDoMes(p.accountId),
  ]);

  return {
    gmv: totais.gmv,
    gmvEligible: totais.gmv_eligible,
    gmvIneligible: totais.gmv_ineligible,
    commissionEstimated: totais.commission_estimated,
    commissionToReceive: totais.commission_to_receive,
    commissionSettled: totais.commission_settled,
    unitsSold: totais.units_sold,
    ordersCount: totais.orders_count,
    avgTicket: totais.avg_ticket,
    goal: meta ? { gmv: meta.gmv, commission: meta.commission } : null,
    byDay,
    byStatus,
    byChannel,
    topProducts: topProducts.map((t) => ({
      productId: t.product_id,
      name: t.name,
      shopName: t.shop_name,
      gmv: t.gmv,
      commission: t.commission,
      units: t.units,
    })),
  };
}

/* ----------------------------------------------------------------- pedidos */

function mapearSku(s: LinhaSku) {
  return {
    id: s.id,
    productId: s.product_id,
    name: s.name,
    shopName: s.shop_name,
    unitPrice: s.unit_price,
    quantity: s.quantity,
    returnedQuantity: s.returned_quantity,
    refundedQuantity: s.refunded_quantity,
    gmv: s.gmv,
    commissionBaseActual: s.commission_base_actual,
    commissionRate: s.commission_rate,
    rates: {
      standard: s.rate_standard,
      shopAds: s.rate_shop_ads,
      bonus: s.rate_bonus,
      reward: s.rate_reward,
    },
    commissionEstimated: s.commission_estimated,
    commissionSettled: s.commission_settled,
    shopAdsCommissionEstimated: s.shop_ads_commission_estimated,
    channel: s.channel,
    contentId: s.content_id,
  };
}

function mapearPedido(o: LinhaPedido, skus: LinhaSku[]) {
  return {
    id: o.id,
    createdAt: o.created_at.toISOString(),
    deliveredAt: iso(o.delivered_at),
    status: o.status,
    currency: o.currency,
    source: o.source,
    sourceAt: o.source_at.toISOString(),
    skus: skus.map(mapearSku),
  };
}

/** Cursor opaco: data e id do último pedido da página. */
export const cursorDe = (o: LinhaPedido) =>
  Buffer.from(`${o.created_at.toISOString()}|${o.id}`).toString('base64url');

function lerCursor(cursor?: string) {
  if (!cursor) return undefined;
  const [data, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(data ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) throw AppError.validacao('Cursor inválido');
  return { createdAt, id };
}

export async function listarPedidos(
  p: Periodo,
  f: FiltroPedidos,
  pagina: { page: number; pageSize: number; cursor?: string },
) {
  const [linhas, total] = await Promise.all([
    pedidos.listar(p, f, {
      limite: pagina.pageSize,
      offset: (pagina.page - 1) * pagina.pageSize,
      cursor: lerCursor(pagina.cursor),
    }),
    pedidos.contar(p, f),
  ]);

  const itens = await pedidos.itensDosPedidos(
    p.accountId,
    linhas.map((l) => l.id),
  );
  const porPedido = new Map<string, LinhaSku[]>();
  for (const item of itens) {
    porPedido.set(item.order_id, [...(porPedido.get(item.order_id) ?? []), item]);
  }

  const ultimo = linhas.at(-1);
  return {
    items: linhas.map((l) => mapearPedido(l, porPedido.get(l.id) ?? [])),
    total,
    page: pagina.page,
    // Lista grande: a próxima página sai daqui, sem offset.
    nextCursor: ultimo && linhas.length === pagina.pageSize ? cursorDe(ultimo) : null,
  };
}

export async function pedido(userId: string, id: string) {
  const linha = await pedidos.buscarPorId(userId, id);
  if (!linha) throw AppError.naoEncontrado('Pedido não encontrado');
  const [skus, historico] = await Promise.all([
    pedidos.itensDosPedidos(linha.account_id, [linha.id]),
    pedidos.historico(linha.account_id, linha.id),
  ]);
  return {
    ...mapearPedido(linha, skus),
    statusHistory: historico.map((h) => ({ status: h.status, at: h.at.toISOString() })),
  };
}

/* ------------------------------------------------------------------ vídeos */

function mapearVideo(v: LinhaVideo) {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    postedAt: v.posted_at.toISOString(),
    duration: v.duration,
    coverUrl: v.cover_url,
    shareUrl: v.share_url,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    gmv: v.gmv,
    commission: v.commission,
    gpm: v.gpm,
  };
}

export async function listarVideos(
  p: Periodo,
  opcoes: { sort: OrdemVideos; hashtag?: string; page: number; pageSize: number },
) {
  const [linhas, total] = await Promise.all([
    videos.listar(p, {
      ordem: opcoes.sort,
      hashtag: opcoes.hashtag,
      limite: opcoes.pageSize,
      offset: (opcoes.page - 1) * opcoes.pageSize,
    }),
    videos.contar(p, opcoes.hashtag),
  ]);
  return { items: linhas.map(mapearVideo), total };
}

export async function video(userId: string, id: string) {
  const linha = await videos.buscarPorId(userId, id);
  if (!linha) throw AppError.naoEncontrado('Vídeo não encontrado');

  const snapshots = await videos.snapshots(linha.account_id, linha.id);
  // Sem venda ligada ao vídeo, o repositório devolve nulo: "ainda não há venda", não zero.
  const vendas = await videos.vendasDoVideo(linha.account_id, linha.id, linha.views);

  return {
    ...mapearVideo({ ...linha, gmv: null, commission: null, gpm: null }),
    gmv: vendas.gmv,
    commission: vendas.commission,
    gpm: vendas.gpm,
    snapshots: snapshots.map((s) => ({ at: s.at.toISOString(), views: s.views, likes: s.likes })),
  };
}

/* ---------------------------------------------------------------- produtos */

function mapearProduto(p: LinhaProduto) {
  return {
    productId: p.product_id,
    name: p.name,
    shopName: p.shop_name,
    imageUrl: p.image_url,
    gmv: p.gmv,
    commission: p.commission,
    commissionRate: p.commission_rate,
    units: p.units,
    refundedUnits: p.refunded_units,
    ordersCount: p.orders_count,
    topChannel: p.top_channel,
  };
}

export async function listarProdutos(
  p: Periodo,
  f: { shopName?: string; q?: string },
  pagina: { sort: OrdemProdutos; page: number; pageSize: number },
) {
  const [linhas, total] = await Promise.all([
    produtos.listar(p, f, {
      ordem: pagina.sort,
      limite: pagina.pageSize,
      offset: (pagina.page - 1) * pagina.pageSize,
    }),
    produtos.contar(p, f),
  ]);
  return { items: linhas.map(mapearProduto), total, page: pagina.page };
}

export async function produto(userId: string, productId: string) {
  const achado = await produtos.buscarPorId(userId, productId);
  if (!achado) throw AppError.naoEncontrado('Produto não encontrado');
  const promovidos = await produtos.videosDoProduto(achado.accountId, productId);
  return {
    ...mapearProduto(achado.linha),
    detailUrl: achado.detailUrl,
    videos: promovidos.map((v) => ({
      id: v.id,
      title: v.title,
      coverUrl: v.cover_url,
      postedAt: v.posted_at.toISOString(),
      views: v.views,
      gmv: v.gmv,
      units: v.units,
    })),
  };
}
