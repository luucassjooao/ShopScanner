import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as auth from '../controllers/auth.ts';
import { ping } from '../lib/db.ts';
import { exigirSessao } from '../middlewares/auth.ts';

/** Tentativa de adivinhar senha é cara por IP... */
const LIMITE_AUTH = { max: 20, timeWindow: '5 minutes' };

/** ...e mais cara ainda por e-mail: um IP compartilhado não tranca a conta de todos. */
const LIMITE_LOGIN = {
  max: 10,
  timeWindow: '5 minutes',
  keyGenerator: (request: FastifyRequest) => {
    const corpo = request.body as { email?: unknown } | undefined;
    const email = typeof corpo?.email === 'string' ? corpo.email.toLowerCase() : '';
    return `${request.ip}:${email}`;
  },
};

/** Rotas abertas: não exigem sessão. */
export async function publicRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const db = await ping();
    return reply.status(db ? 200 : 503).send({ status: db ? 'ok' : 'error', db });
  });

  app.post('/auth/register', { config: { rateLimit: LIMITE_AUTH } }, auth.registrar);
  app.post('/auth/login', { config: { rateLimit: LIMITE_LOGIN } }, auth.entrar);
  app.post('/auth/refresh', { config: { rateLimit: LIMITE_AUTH } }, auth.girar);
  app.post('/auth/logout', auth.sair);
  app.post('/auth/forgot-password', { config: { rateLimit: LIMITE_AUTH } }, auth.esqueciSenha);
  app.post('/auth/reset-password', { config: { rateLimit: LIMITE_AUTH } }, auth.redefinirSenha);
}

/** Rotas de sessão: o hook roda antes de todas as desta instância. */
export async function privateRoutes(app: FastifyInstance) {
  app.addHook('onRequest', exigirSessao);

  app.get('/auth/session', auth.sessaoAtual);
  app.get('/auth/sessions', auth.listarSessoes);
  app.delete('/auth/sessions/:id', auth.revogarUmaSessao);
  app.post('/auth/logout-all', auth.sairDeTodas);
}

export async function routes(app: FastifyInstance) {
  await app.register(publicRoutes);
  await app.register(privateRoutes);
}
