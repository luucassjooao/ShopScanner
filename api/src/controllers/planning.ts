import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as planejamento from '../services/planning.ts';

const roteiro = z.object({
  hook: z.string(),
  scene1: z.string(),
  scene2: z.string(),
  cta: z.string(),
  caption: z.string(),
});

const entrada = z.object({
  title: z.string().min(1).max(200),
  productId: z.string().nullable().default(null),
  scheduledFor: z.iso.datetime().nullable().default(null),
  status: z.enum(['IDEA', 'SCRIPT', 'RECORDED', 'EDITED', 'POSTED']).default('IDEA'),
  videoId: z.string().nullable().default(null),
  script: roteiro.nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
});

const dinheiro = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'dinheiro é texto decimal, como "1234.56"')
  .nullable();

const meta = z.object({
  accountId: z.guid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  gmv: dinheiro,
  commission: dinheiro,
});

const avisos = z.object({
  orderSettled: z.boolean(),
  orderFrozen: z.boolean(),
  orderRefunded: z.boolean(),
  goalReached: z.boolean(),
  paceDrop: z.boolean(),
  viewsDrop: z.boolean(),
  postReminder: z.boolean(),
  channels: z.object({ inApp: z.boolean(), email: z.boolean() }),
});

const id = z.object({ id: z.guid() });

const paraRepo = (d: z.infer<typeof entrada>) => ({
  ...d,
  scheduledFor: d.scheduledFor ? new Date(d.scheduledFor) : null,
});

export async function listarPlanos(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await planejamento.listarPlanos(request.autenticado!.usuario.id));
}

export async function criarPlano(request: FastifyRequest, reply: FastifyReply) {
  const dados = entrada.parse(request.body);
  const plano = await planejamento.criarPlano(request.autenticado!.usuario.id, paraRepo(dados));
  return reply.status(201).send(plano);
}

export async function atualizarPlano(request: FastifyRequest, reply: FastifyReply) {
  const { id: planoId } = id.parse(request.params);
  const { scheduledFor, ...resto } = entrada.partial().parse(request.body);
  // Campo ausente não muda nada; presente e nulo limpa a data.
  const data =
    'scheduledFor' in (request.body as object)
      ? { scheduledFor: scheduledFor ? new Date(scheduledFor) : null }
      : {};
  return reply.send(
    await planejamento.atualizarPlano(request.autenticado!.usuario.id, planoId, {
      ...resto,
      ...data,
    }),
  );
}

export async function apagarPlano(request: FastifyRequest, reply: FastifyReply) {
  const { id: planoId } = id.parse(request.params);
  await planejamento.apagarPlano(request.autenticado!.usuario.id, planoId);
  return reply.status(204).send();
}

export async function listarMetas(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await planejamento.listarMetas(request.autenticado!.usuario.id));
}

export async function salvarMeta(request: FastifyRequest, reply: FastifyReply) {
  const dados = meta.parse(request.body);
  return reply.send(await planejamento.salvarMeta(request.autenticado!.usuario.id, dados));
}

export async function lerAvisos(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await planejamento.avisos(request.autenticado!.usuario.id));
}

export async function salvarAvisos(request: FastifyRequest, reply: FastifyReply) {
  const dados = avisos.parse(request.body);
  return reply.send(await planejamento.salvarAvisos(request.autenticado!.usuario.id, dados));
}
