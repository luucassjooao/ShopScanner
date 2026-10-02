import type { FastifyReply, FastifyRequest } from 'fastify';
import { COOKIE_ACESSO } from '../config/constants.ts';
import { AppError } from '../lib/errors.ts';
import { lerJwt } from '../lib/jwt.ts';
import { buscarSessaoAtiva } from '../repositories/sessions.ts';
import { buscarPorId } from '../repositories/users.ts';

const NAO_AUTENTICADO = new AppError(401, 'NAO_AUTENTICADO', 'Entre para continuar');

/**
 * Lê a sessão do cookie, ou `null`. O JWT sozinho não basta:
 * sessão revogada e senha trocada (que muda `credentials_version`) precisam
 * derrubar o token antes dos 15 minutos.
 */
export async function lerSessao(request: FastifyRequest) {
  const claims = lerJwt(request.cookies[COOKIE_ACESSO]);
  if (
    !claims ||
    typeof claims.sub !== 'string' ||
    typeof claims.sid !== 'string' ||
    typeof claims.ver !== 'number'
  ) {
    return null;
  }

  // ponytail: duas consultas por requisição; vira um join se pesar no profiling.
  const sessao = await buscarSessaoAtiva(claims.sid);
  if (!sessao || sessao.userId !== claims.sub) return null;

  const usuario = await buscarPorId(claims.sub);
  if (!usuario || usuario.credentialsVersion !== claims.ver) return null;

  return { usuario, sessionId: sessao.id };
}

export async function exigirSessao(request: FastifyRequest, _reply: FastifyReply) {
  const sessao = await lerSessao(request);
  if (!sessao) throw NAO_AUTENTICADO;
  request.autenticado = sessao;
}
