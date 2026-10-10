import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as auth from '../controllers/auth.ts';
import * as conexoes from '../controllers/connections.ts';
import * as dados from '../controllers/data.ts';
import * as importacoes from '../controllers/imports.ts';
import * as planejamento from '../controllers/planning.ts';
import * as me from '../controllers/me.ts';
import { ping } from '../lib/db.ts';
import { AppError } from '../lib/errors.ts';
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

/**
 * ...e, por cima, um teto só por IP no login. O de e-mail mais IP sozinho deixava
 * um IP tentar uma senha comum em centenas de e-mails diferentes (password
 * spraying): cada e-mail tinha o seu contador, e só o global de 300/min segurava.
 * ponytail: mesmo problema de NAT do global — muita gente atrás de um IP de
 * operadora divide este teto. 30 logins em 5 minutos por IP ainda é folgado para
 * gente de verdade; se apertar, o upgrade é contar falhas, não tentativas.
 */
const LIMITE_LOGIN_POR_IP = { max: 30, timeWindow: '5 minutes' };

/** Rotas abertas: não exigem sessão. */
export async function publicRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const db = await ping();
    return reply.status(db ? 200 : 503).send({ status: db ? 'ok' : 'error', db });
  });

  app.post('/auth/register', { config: { rateLimit: LIMITE_AUTH } }, auth.registrar);
  // `createRateLimit`, e não `app.rateLimit()`: o plugin marca a requisição na
  // primeira passagem e ignora qualquer segundo limitador dela — com `rateLimit()`
  // aqui, o teto por e-mail (o do `config`) parava de contar, sem erro nenhum.
  // `createRateLimit` só conta, num contador próprio, e quem decide o 429 somos nós.
  const contarLoginDoIp = app.createRateLimit(LIMITE_LOGIN_POR_IP);
  app.post(
    '/auth/login',
    {
      config: { rateLimit: LIMITE_LOGIN },
      preHandler: async (request, reply) => {
        const contagem = await contarLoginDoIp(request);
        if (!contagem.isAllowed && contagem.isExceeded) {
          reply.header('retry-after', contagem.ttlInSeconds);
          throw new AppError(429, 'MUITAS_REQUISICOES', 'Tente de novo em instantes');
        }
      },
    },
    auth.entrar,
  );
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
  app.patch('/me', me.atualizarPerfil);
  app.put('/me/password', { config: { rateLimit: LIMITE_AUTH } }, me.definirSenha);
  app.post('/me/avatar', me.enviarAvatar);
  app.get('/me/avatar', me.lerAvatar);

  app.get('/accounts', conexoes.listarContas);
  app.post('/connections/tiktok/start', conexoes.iniciarTiktok);
  app.delete('/connections/:id', conexoes.desconectar);

  app.get('/summary', dados.resumo);
  app.get('/orders', dados.listarPedidos);
  app.get('/orders/:id', dados.pedido);
  app.get('/videos', dados.listarVideos);
  app.get('/videos/:id', dados.video);
  app.get('/products', dados.listarProdutos);
  app.get('/products/:id', dados.produto);

  app.get('/plans', planejamento.listarPlanos);
  app.post('/plans', planejamento.criarPlano);
  app.patch('/plans/:id', planejamento.atualizarPlano);
  app.delete('/plans/:id', planejamento.apagarPlano);
  app.get('/goals', planejamento.listarMetas);
  app.put('/goals', planejamento.salvarMeta);
  app.get('/me/notifications', planejamento.lerAvisos);
  app.put('/me/notifications', planejamento.salvarAvisos);

  app.post('/imports', importacoes.enviar);
  app.get('/imports', importacoes.listar);
  app.get('/imports/:id', importacoes.buscar);

  app.get('/me/export', me.exportar);
  app.delete('/me', me.excluirConta);
}

export async function routes(app: FastifyInstance) {
  await app.register(publicRoutes);
  await app.register(privateRoutes);
}
