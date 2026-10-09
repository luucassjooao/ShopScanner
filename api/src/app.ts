import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { HEADER_CSRF, VALOR_CSRF } from './config/constants.ts';
import { env, isProd } from './config/env.ts';
import { AppError } from './lib/errors.ts';
import { sql } from './lib/db.ts';
import { routes } from './routes/index.ts';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : isProd ? 'info' : 'debug',
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    },
    // Request id reaproveita o header do proxy quando existe; senão, gera um.
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    trustProxy: isProd,
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie, { secret: env.JWT_SECRET });
  await app.register(rateLimit, {
    // No teste o limite global sai da frente; o que se quer provar lá são os
    // limites de /auth, não o teto por IP.
    // ponytail: teto por IP. NAT de operadora móvel põe muita gente atrás do mesmo
    // IP, então é o limite conhecido deste modelo. Upgrade: limite por usuário
    // autenticado, quando houver sinal de que 300 incomoda.
    max: env.NODE_ENV === 'test' ? 1000 : 300,
    timeWindow: '1 minute',
    // preHandler, e não onRequest, porque o limite do login é por e-mail mais
    // IP — e o e-mail só existe depois do corpo lido.
    hook: 'preHandler',
  });

  app.decorateRequest('autenticado', null);

  // SameSite=Lax já cobre o caso comum; este header é a segunda tranca, e só o
  // nosso front manda. Requisição que muda estado sem ele não passa.
  app.addHook('onRequest', async (request) => {
    const mudaEstado = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mudaEstado && request.headers[HEADER_CSRF] !== VALOR_CSRF) {
      throw new AppError(403, 'CABECALHO_AUSENTE', 'Requisição recusada');
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn({ err: error, code: error.code }, 'erro tratado');
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }
    if (error instanceof ZodError || error.validation) {
      request.log.warn({ err: error }, 'entrada inválida');
      return reply.status(400).send({ code: 'VALIDACAO', message: 'Dados inválidos' });
    }
    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send({ code: 'MUITAS_REQUISICOES', message: 'Tente de novo em instantes' });
    }
    // Daqui para baixo é erro nosso: o detalhe fica no log, o cliente vê genérico.
    request.log.error({ err: error }, 'erro não tratado');
    return reply.status(500).send({ code: 'INTERNO', message: 'Erro interno' });
  });

  await app.register(routes);
  app.addHook('onClose', () => sql.end({ timeout: 5 }));

  return app;
}
