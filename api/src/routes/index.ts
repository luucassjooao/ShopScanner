import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as auth from '../controllers/auth.ts';
import * as conexoes from '../controllers/connections.ts';
import * as me from '../controllers/me.ts';
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

  // Navegação do navegador, não fetch: por isso são GET e não exigem o header.
  app.get('/auth/google/start', { config: { rateLimit: LIMITE_AUTH } }, auth.iniciarGoogle);
  app.get('/auth/google/callback', { config: { rateLimit: LIMITE_AUTH } }, auth.retornoGoogle);
  app.get('/connections/tiktok/callback', conexoes.retornoTiktok);
}

/** Rotas de sessão: o hook roda antes de todas as desta instância. */
export async function privateRoutes(app: FastifyInstance) {
  app.addHook('onRequest', exigirSessao);

  app.get('/auth/session', auth.sessaoAtual);
  app.get('/auth/sessions', auth.listarSessoes);
  app.delete('/auth/sessions/:id', auth.revogarUmaSessao);
  app.post('/auth/logout-all', auth.sairDeTodas);
  app.get('/auth/identities', auth.listarIdentidades);
  app.delete('/auth/identities/:provider', auth.desvincularIdentidade);
  app.put('/me/password', { config: { rateLimit: LIMITE_AUTH } }, me.definirSenha);

  app.get('/accounts', conexoes.listarContas);
  app.post('/connections/tiktok/start', conexoes.iniciarTiktok);
  app.delete('/connections/:id', conexoes.desconectar);
}

export async function routes(app: FastifyInstance) {
  await app.register(publicRoutes);
  await app.register(privateRoutes);
}
