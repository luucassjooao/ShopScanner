import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { definirCookiesDeSessao } from '../lib/cookies.ts';
import * as auth from '../services/auth.ts';

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
