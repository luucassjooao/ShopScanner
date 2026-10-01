import type { FastifyInstance } from 'fastify';
import { ping } from '../lib/db.ts';

/** Rotas abertas: não exigem sessão. */
export async function publicRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const db = await ping();
    return reply.status(db ? 200 : 503).send({ status: db ? 'ok' : 'error', db });
  });
}

/** Rotas de sessão. Nasce vazio: o middleware de autenticação entra aqui. */
export async function privateRoutes(_app: FastifyInstance) {}

export async function routes(app: FastifyInstance) {
  await app.register(publicRoutes);
  await app.register(privateRoutes);
}
