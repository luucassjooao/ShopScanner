import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as auth from '../services/auth.ts';
import { definirCookiesDeSessao, limparCookiesDeSessao } from '../lib/cookies.ts';
import * as me from '../services/me.ts';

const senha = z.object({
  // Opcional de propósito: conta criada pelo Google ainda não tem senha atual.
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200),
});

export async function definirSenha(request: FastifyRequest, reply: FastifyReply) {
  const dados = senha.parse(request.body);
  const tokens = await auth.definirSenha(request.autenticado!.usuario, dados, {
    userAgent: request.headers['user-agent'] ?? null,
    ip: request.ip || null,
  });
  // A sessão antiga morreu junto com as outras; esta aba segue com a nova.
  definirCookiesDeSessao(reply, tokens);
  return reply.status(204).send();
}

export async function exportar(request: FastifyRequest, reply: FastifyReply) {
  const dados = await me.exportar(request.autenticado!.usuario);
  return reply.header('content-disposition', 'attachment; filename="shopscanner.json"').send(dados);
}

export async function excluirConta(request: FastifyRequest, reply: FastifyReply) {
  await me.excluirConta(request.autenticado!.usuario.id);
  limparCookiesDeSessao(reply);
  return reply.status(204).send();
}
