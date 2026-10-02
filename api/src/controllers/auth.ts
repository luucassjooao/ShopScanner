import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CAMINHO_OAUTH,
  COOKIE_ACESSO,
  COOKIE_OAUTH,
  COOKIE_REFRESH,
  MOTIVO,
  OAUTH_SEGUNDOS,
} from '../config/constants.ts';
import { env } from '../config/env.ts';
import { definirCookiesDeSessao, limparCookiesDeSessao } from '../lib/cookies.ts';
import { AppError } from '../lib/errors.ts';
import * as google from '../lib/google.ts';
import { lerSessao } from '../middlewares/auth.ts';
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

/* ------------------------------------------------------------ Google OIDC */

const RECUSADO = new AppError(400, 'REQUISICAO_INVALIDA', 'Requisição inválida');

const guardado = z.object({ state: z.string(), nonce: z.string(), verifier: z.string() });
const retorno = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

const cookieOauth = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: CAMINHO_OAUTH,
  signed: true,
} as const;

/** Erro sempre volta para a tela de login com um código curto, nunca com detalhe. */
function paraLogin(reply: FastifyReply, codigo: string) {
  return reply.redirect(`${env.WEB_ORIGIN}/entrar?erro=${codigo}`, 302);
}

export async function iniciarGoogle(_request: FastifyRequest, reply: FastifyReply) {
  if (!google.configurado()) return paraLogin(reply, 'GOOGLE_INDISPONIVEL');

  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');
  const { verifier, challenge } = google.desafioPkce();

  // Os três viajam juntos num cookie assinado de 10 minutos: é o que amarra o
  // callback a este início de fluxo.
  reply.setCookie(COOKIE_OAUTH, JSON.stringify({ state, nonce, verifier }), {
    ...cookieOauth,
    maxAge: OAUTH_SEGUNDOS,
  });
  return reply.redirect(google.urlDeAutorizacao({ state, nonce, challenge }), 302);
}

export async function retornoGoogle(request: FastifyRequest, reply: FastifyReply) {
  const query = retorno.parse(request.query);
  const assinado = request.cookies[COOKIE_OAUTH];
  reply.clearCookie(COOKIE_OAUTH, { ...cookieOauth, signed: false });

  if (query.error) return paraLogin(reply, 'GOOGLE_RECUSADO');

  const aberto = assinado ? request.unsignCookie(assinado) : null;
  if (!aberto?.valid || !aberto.value) throw RECUSADO;
  const inicio = guardado.safeParse(JSON.parse(aberto.value));
  if (!inicio.success) throw RECUSADO;

  // State ausente ou diferente: 400 seco, sem dizer o que não bateu.
  if (!query.code || !query.state || query.state !== inicio.data.state) throw RECUSADO;

  const idToken = await google.trocarCodigo(query.code, inicio.data.verifier);
  const conta = await google.validarIdToken(idToken, inicio.data.nonce);
  if (!conta.emailVerificado || !conta.email) return paraLogin(reply, 'EMAIL_NAO_VERIFICADO');

  const logado = await lerSessao(request);
  try {
    const { tokens } = await auth.entrarComGoogle(
      { providerUserId: conta.providerUserId, email: conta.email, nome: conta.nome },
      contexto(request),
      logado?.usuario.id ?? null,
    );
    // Sem tokens: já estava logado, era só vincular. A sessão atual continua.
    if (tokens) definirCookiesDeSessao(reply, tokens);
  } catch (erro) {
    if (erro instanceof AppError && erro.statusCode === 409) return paraLogin(reply, erro.code);
    throw erro;
  }
  return reply.redirect(env.WEB_ORIGIN, 302);
}

export async function listarIdentidades(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await auth.identidadesDoUsuario(request.autenticado!.usuario));
}

export async function desvincularIdentidade(request: FastifyRequest, reply: FastifyReply) {
  const { provider } = z
    .object({
      provider: z
        .string()
        .transform((v) => v.toUpperCase())
        .pipe(z.enum(['GOOGLE'])),
    })
    .parse(request.params);
  await auth.desvincularIdentidade(request.autenticado!.usuario, provider);
  return reply.status(204).send();
}
