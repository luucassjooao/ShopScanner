import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { COOKIE_ACESSO, COOKIE_REFRESH, MOTIVO } from '../config/constants.ts';
import { env } from '../config/env.ts';
import { definirCookiesDeSessao, limparCookiesDeSessao } from '../lib/cookies.ts';
import { AppError } from '../lib/errors.ts';
import { revogarSessao, listarSessoesDoUsuario } from '../repositories/sessions.ts';
import * as auth from '../services/auth.ts';

const senha = z.string().min(8).max(200);
const email = z.email().max(255);

const registro = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  password: senha,
  acceptedTermsVersion: z.string().min(1).max(40),
});

const credenciais = z.object({ email, password: z.string().min(1).max(200) });
const esqueci = z.object({ email });
const redefinicao = z.object({ token: z.string().min(1), newPassword: senha });

function contexto(request: FastifyRequest): auth.Contexto {
  return { userAgent: request.headers['user-agent'] ?? null, ip: request.ip || null };
}

/** Nunca devolve token no corpo: a sessão sai toda em cookie. */
export async function registrar(request: FastifyRequest, reply: FastifyReply) {
  const dados = registro.parse(request.body);
  const { usuario, tokens } = await auth.registrar(dados, contexto(request));
  definirCookiesDeSessao(reply, tokens);
  return reply.status(201).send(await auth.montarSessao(usuario));
}

export async function entrar(request: FastifyRequest, reply: FastifyReply) {
  const dados = credenciais.parse(request.body);
  const { usuario, tokens } = await auth.entrar(dados, contexto(request));
  definirCookiesDeSessao(reply, tokens);
  return reply.send(await auth.montarSessao(usuario));
}

export async function girar(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tokens = await auth.girar(request.cookies[COOKIE_REFRESH], request.log);
    definirCookiesDeSessao(reply, tokens);
    return reply.status(204).send();
  } catch (erro) {
    limparCookiesDeSessao(reply);
    throw erro;
  }
}

export async function sair(request: FastifyRequest, reply: FastifyReply) {
  await auth.sair(request.cookies[COOKIE_ACESSO]);
  limparCookiesDeSessao(reply);
  return reply.status(204).send();
}

export async function sairDeTodas(request: FastifyRequest, reply: FastifyReply) {
  await auth.sairDeTodas(request.autenticado!.usuario.id);
  limparCookiesDeSessao(reply);
  return reply.status(204).send();
}

/** Responde igual existindo ou não a conta: não serve de lista de e-mails. */
export async function esqueciSenha(request: FastifyRequest, reply: FastifyReply) {
  const { email: endereco } = esqueci.parse(request.body);
  const token = await auth.pedirRedefinicao(endereco);
  if (token && env.NODE_ENV !== 'production') {
    // Sem envio de e-mail ainda: em desenvolvimento o link sai no log.
    request.log.info({ token }, 'token de redefinição de senha (só fora de produção)');
  }
  return reply.status(204).send();
}

export async function redefinirSenha(request: FastifyRequest, reply: FastifyReply) {
  const dados = redefinicao.parse(request.body);
  await auth.redefinirSenha(dados.token, dados.newPassword);
  limparCookiesDeSessao(reply);
  return reply.status(204).send();
}

export async function sessaoAtual(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await auth.montarSessao(request.autenticado!.usuario));
}

export async function listarSessoes(request: FastifyRequest, reply: FastifyReply) {
  const { usuario, sessionId } = request.autenticado!;
  const sessoes = await listarSessoesDoUsuario(usuario.id);
  return reply.send(
    sessoes.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.id === sessionId,
    })),
  );
}

export async function revogarUmaSessao(request: FastifyRequest, reply: FastifyReply) {
  const { id } = z.object({ id: z.uuid() }).parse(request.params);
  const { usuario, sessionId } = request.autenticado!;
  const revogadas = await revogarSessao(id, usuario.id, MOTIVO.revogadaPeloUsuario);
  if (revogadas === 0) throw AppError.naoEncontrado('Sessão não encontrada');
  if (id === sessionId) limparCookiesDeSessao(reply);
  return reply.status(204).send();
}
