import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CAMINHO_CONEXAO, COOKIE_CONEXAO, OAUTH_SEGUNDOS } from '../config/constants.ts';
import { env } from '../config/env.ts';
import { AppError } from '../lib/errors.ts';
import { lerSessao } from '../middlewares/auth.ts';
import * as conexoes from '../services/connections.ts';

const RECUSADO = new AppError(400, 'REQUISICAO_INVALIDA', 'Requisição inválida');

const tipo = z.enum(['VIDEOS', 'SHOP']);
const inicio = z.object({ kind: tipo.default('VIDEOS') });
const guardado = z.object({ state: z.string(), verifier: z.string(), kind: tipo });
const retorno = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

const cookieConexao = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: CAMINHO_CONEXAO,
  signed: true,
} as const;

/** Conectar e desconectar acontecem na tela de Configurações. */
function paraConfiguracoes(reply: FastifyReply, erro?: string) {
  const destino = `${env.WEB_ORIGIN}/configuracoes${erro ? `?erro=${erro}` : '?conectado=1'}`;
  return reply.redirect(destino, 302);
}

export async function listarContas(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await conexoes.contasDoUsuario(request.autenticado!.usuario.id));
}

export async function iniciarTiktok(request: FastifyRequest, reply: FastifyReply) {
  const { kind } = inicio.parse(request.body ?? {});
  const { authorizeUrl, state, verifier } = conexoes.iniciarTiktok(kind);

  reply.setCookie(COOKIE_CONEXAO, JSON.stringify({ state, verifier, kind }), {
    ...cookieConexao,
    maxAge: OAUTH_SEGUNDOS,
  });
  // Diferente do login social, aqui quem navega é o front: ele recebe a URL.
  return reply.send({ authorizeUrl });
}

export async function retornoTiktok(request: FastifyRequest, reply: FastifyReply) {
  const query = retorno.parse(request.query);
  const assinado = request.cookies[COOKIE_CONEXAO];
  reply.clearCookie(COOKIE_CONEXAO, { ...cookieConexao, signed: false });

  if (query.error) return paraConfiguracoes(reply, 'TIKTOK_RECUSADO');

  const aberto = assinado ? request.unsignCookie(assinado) : null;
  if (!aberto?.valid || !aberto.value) throw RECUSADO;
  const guardada = guardado.safeParse(JSON.parse(aberto.value));
  if (!guardada.success) throw RECUSADO;
  if (!query.code || !query.state || query.state !== guardada.data.state) throw RECUSADO;

  // A conexão é de quem está logado: sem sessão não há a quem pendurar.
  const sessao = await lerSessao(request);
  if (!sessao) return reply.redirect(`${env.WEB_ORIGIN}/entrar?erro=SESSAO_EXPIRADA`, 302);

  try {
    await conexoes.concluirTiktok({
      userId: sessao.usuario.id,
      kind: guardada.data.kind,
      code: query.code,
      verifier: guardada.data.verifier,
    });
  } catch (erro) {
    if (erro instanceof AppError && erro.statusCode < 500)
      return paraConfiguracoes(reply, erro.code);
    throw erro;
  }
  return paraConfiguracoes(reply);
}

export async function desconectar(request: FastifyRequest, reply: FastifyReply) {
  const { id } = z.object({ id: z.uuid() }).parse(request.params);
  await conexoes.desconectar(id, request.autenticado!.usuario.id);
  return reply.status(204).send();
}
