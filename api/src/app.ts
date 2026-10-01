import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
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
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn({ err: error, code: error.code }, 'erro tratado');
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error instanceof ZodError || error.validation) {
      request.log.warn({ err: error }, 'entrada inválida');
      return reply.status(400).send({ error: 'VALIDACAO', message: 'Dados inválidos' });
    }
    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send({ error: 'MUITAS_REQUISICOES', message: 'Tente de novo em instantes' });
    }
    // Daqui para baixo é erro nosso: o detalhe fica no log, o cliente vê genérico.
    request.log.error({ err: error }, 'erro não tratado');
    return reply.status(500).send({ error: 'INTERNO', message: 'Erro interno' });
  });

  await app.register(routes);
  app.addHook('onClose', () => sql.end({ timeout: 5 }));

  return app;
}
