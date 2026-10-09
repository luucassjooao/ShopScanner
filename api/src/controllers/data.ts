import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as bi from '../services/bi.ts';

/** Período vem do front em ISO UTC; o dia de São Paulo já foi convertido lá. */
const periodo = z.object({
  accountId: z.guid(),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
});

const paginacao = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const canal = z.enum(['VIDEO', 'LIVE', 'PRE_LIVE', 'SHOP', 'LINKSHARE', 'PROMOTION_PAGE']);
const status = z.enum([
  'AWAITING_PAYMENT',
  'TO_SETTLE',
  'SETTLED',
  'REFUNDED',
  'FROZEN',
  'INELIGIBLE',
]);

const consultaPedidos = periodo.extend(paginacao.shape).extend({
  status: status.optional(),
  channel: canal.optional(),
  productId: z.string().optional(),
  shopName: z.string().optional(),
  q: z.string().optional(),
});

const consultaVideos = periodo.extend({
  sort: z.enum(['postedAt', 'views', 'gmv', 'gpm']).default('postedAt'),
  hashtag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const consultaProdutos = periodo.extend({
  sort: z.enum(['gmv', 'commission', 'units', 'refunds']).default('gmv'),
  shopName: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const id = z.object({ id: z.string().min(1) });

const comDatas = (p: z.infer<typeof periodo>) => ({
  accountId: p.accountId,
  from: new Date(p.from),
  to: new Date(p.to),
});

export async function resumo(request: FastifyRequest, reply: FastifyReply) {
  const p = periodo.parse(request.query);
  await bi.conferirConta(request.autenticado!.usuario.id, p.accountId);
  return reply.send(await bi.resumo(comDatas(p)));
}

export async function listarPedidos(request: FastifyRequest, reply: FastifyReply) {
  const q = consultaPedidos.parse(request.query);
  await bi.conferirConta(request.autenticado!.usuario.id, q.accountId);
  return reply.send(
    await bi.listarPedidos(
      comDatas(q),
      {
        status: q.status,
        channel: q.channel,
        productId: q.productId,
        shopName: q.shopName,
        q: q.q,
      },
      { page: q.page, pageSize: q.pageSize, cursor: q.cursor },
    ),
  );
}

export async function pedido(request: FastifyRequest, reply: FastifyReply) {
  const { id: pedidoId } = id.parse(request.params);
  return reply.send(await bi.pedido(request.autenticado!.usuario.id, pedidoId));
}

export async function listarVideos(request: FastifyRequest, reply: FastifyReply) {
  const q = consultaVideos.parse(request.query);
  // Conferir a conta é o que garante que ela é da pessoa; não há mais gatilho de loja aqui.
  await bi.conferirConta(request.autenticado!.usuario.id, q.accountId);
  return reply.send(
    await bi.listarVideos(comDatas(q), {
      sort: q.sort,
      hashtag: q.hashtag,
      page: q.page,
      pageSize: q.pageSize,
    }),
  );
}

export async function video(request: FastifyRequest, reply: FastifyReply) {
  const { id: videoId } = id.parse(request.params);
  return reply.send(await bi.video(request.autenticado!.usuario.id, videoId));
}

export async function listarProdutos(request: FastifyRequest, reply: FastifyReply) {
  const q = consultaProdutos.parse(request.query);
  await bi.conferirConta(request.autenticado!.usuario.id, q.accountId);
  return reply.send(
    await bi.listarProdutos(
      comDatas(q),
      { shopName: q.shopName, q: q.q },
      { sort: q.sort, page: q.page, pageSize: q.pageSize },
    ),
  );
}

export async function produto(request: FastifyRequest, reply: FastifyReply) {
  const { id: productId } = id.parse(request.params);
  return reply.send(await bi.produto(request.autenticado!.usuario.id, productId));
}
