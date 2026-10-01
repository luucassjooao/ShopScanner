import { createHash, randomBytes } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import {
  ACESSO_SEGUNDOS,
  MOTIVO,
  REFRESH_SEGUNDOS,
  RESET_SENHA_SEGUNDOS,
} from '../config/constants.ts';
import { env } from '../config/env.ts';
import { transaction, type Executor } from '../lib/db.ts';
import { AppError } from '../lib/errors.ts';
import { criarJwt, lerJwt } from '../lib/jwt.ts';
import { conferirSenha, hashSenha } from '../lib/password.ts';
import * as usuarios from '../repositories/users.ts';
import type { Usuario } from '../repositories/users.ts';
import * as sessoes from '../repositories/sessions.ts';

export type Tokens = { acesso: string; refresh: string };
export type Contexto = { userAgent: string | null; ip: string | null };

/** Mesma resposta para e-mail que não existe e senha errada. */
const CREDENCIAIS = new AppError(401, 'CREDENCIAIS', 'E-mail ou senha incorretos');
const SESSAO = new AppError(401, 'SESSAO_INVALIDA', 'Sessão expirada. Entre de novo.');

/** O token do cookie nunca encosta no banco: só este hash, com pepper. */
function hashRefresh(token: string): Buffer {
  return createHash('sha256').update(env.REFRESH_TOKEN_PEPPER).update(token).digest();
}

async function emitirTokens(
  dados: { usuario: Usuario; sessionId: string; familyId: string | null },
  db: Executor,
): Promise<{ tokens: Tokens; refreshId: string }> {
  const refresh = randomBytes(32).toString('base64url');
  const linha = await sessoes.criarRefresh(
    {
      sessionId: dados.sessionId,
      familyId: dados.familyId,
      tokenHash: hashRefresh(refresh),
      expiresAt: new Date(Date.now() + REFRESH_SEGUNDOS * 1000),
    },
    db,
  );
  const acesso = criarJwt(
    { sub: dados.usuario.id, sid: dados.sessionId, ver: dados.usuario.credentialsVersion },
    ACESSO_SEGUNDOS,
  );
  return { tokens: { acesso, refresh }, refreshId: linha.id };
}

async function abrirSessao(usuario: Usuario, ctx: Contexto): Promise<Tokens> {
  return transaction(async (tx) => {
    const sessao = await sessoes.criarSessao(
      { userId: usuario.id, userAgent: ctx.userAgent, ip: ctx.ip },
      tx,
    );
    const { tokens } = await emitirTokens({ usuario, sessionId: sessao.id, familyId: null }, tx);
    return tokens;
  });
}

export async function registrar(
  dados: { name: string; email: string; password: string; acceptedTermsVersion: string },
  ctx: Contexto,
): Promise<{ usuario: Usuario; tokens: Tokens }> {
  if (await usuarios.buscarPorEmail(dados.email)) {
    throw new AppError(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail');
  }
  const usuario = await usuarios.criar({
    name: dados.name,
    email: dados.email,
    passwordHash: await hashSenha(dados.password),
    acceptedTermsVersion: dados.acceptedTermsVersion,
  });
  return { usuario, tokens: await abrirSessao(usuario, ctx) };
}

export async function entrar(
  dados: { email: string; password: string },
  ctx: Contexto,
): Promise<{ usuario: Usuario; tokens: Tokens }> {
  const usuario = await usuarios.buscarPorEmail(dados.email);
  const senhaConfere = await conferirSenha(usuario?.passwordHash ?? null, dados.password);
  if (!usuario || !senhaConfere) throw CREDENCIAIS;
  return { usuario, tokens: await abrirSessao(usuario, ctx) };
}

/**
 * Rotação. Tudo numa transação: marca o antigo como usado, emite o novo na
 * mesma família e liga um ao outro. Token que chega já usado derruba a família
 * inteira e encerra a sessão.
 */
export async function girar(token: string | undefined, log: FastifyBaseLogger): Promise<Tokens> {
  if (!token) throw SESSAO;
  const hash = hashRefresh(token);

  const atual = await sessoes.buscarRefreshPorHash(hash);
  if (!atual) throw SESSAO;

  if (atual.usedAt !== null) {
    // Em transação própria, e não na da rotação: a rotação termina em erro, e
    // o rollback desfaria justamente a queima que precisa ficar gravada.
    await transaction(async (tx) => {
      await sessoes.queimarFamilia(atual.familyId, tx);
      await tx`update sessions set revoked_at = now(), revoked_reason = ${MOTIVO.reusoDeRefresh}
                where id = ${atual.sessionId} and revoked_at is null`;
    });
    log.warn(
      { sid: atual.sessionId, familyId: atual.familyId },
      'refresh token reutilizado: família revogada',
    );
    throw SESSAO;
  }

  if (atual.expiresAt.getTime() <= Date.now()) throw SESSAO;

  return transaction(async (tx) => {
    const sessao = await sessoes.buscarSessaoAtiva(atual.sessionId, tx);
    if (!sessao) throw SESSAO;

    const usuario = await usuarios.buscarPorId(sessao.userId, tx);
    if (!usuario) throw SESSAO;

    // Condicional: se outra requisição marcou primeiro, esta perde a corrida e
    // não gira nada. Sem isso, dois refresh simultâneos criariam duas famílias.
    if (!(await sessoes.marcarRefreshUsado(atual.id, tx))) throw SESSAO;

    const { tokens, refreshId } = await emitirTokens(
      { usuario, sessionId: sessao.id, familyId: atual.familyId },
      tx,
    );
    await sessoes.apontarSucessor(atual.id, refreshId, tx);
    await sessoes.tocarSessao(sessao.id, tx);
    return tokens;
  });
}

/** Sai da sessão do token de acesso, mesmo que ele já tenha expirado. */
export async function sair(tokenDeAcesso: string | undefined): Promise<void> {
  const claims = lerJwt(tokenDeAcesso, { ignorarExpiracao: true });
  if (typeof claims?.sid !== 'string' || typeof claims?.sub !== 'string') return;
  await sessoes.revogarSessao(claims.sid, claims.sub, MOTIVO.logout);
}

export async function sairDeTodas(userId: string): Promise<void> {
  await sessoes.revogarSessoesDoUsuario(userId, MOTIVO.logoutAll);
}

/**
 * Token de redefinição assinado, sem tabela: ele carrega a versão das
 * credenciais, e redefinir a senha incrementa essa versão — então o token
 * vale uma vez só e todos os outros morrem junto.
 */
export async function pedirRedefinicao(email: string): Promise<string | null> {
  const usuario = await usuarios.buscarPorEmail(email);
  if (!usuario) return null;
  return criarJwt(
    { sub: usuario.id, ver: usuario.credentialsVersion, pur: 'reset' },
    RESET_SENHA_SEGUNDOS,
  );
}

export async function redefinirSenha(token: string, novaSenha: string): Promise<void> {
  const claims = lerJwt(token);
  const invalido = new AppError(400, 'TOKEN_INVALIDO', 'Link expirado ou já usado');
  if (claims?.pur !== 'reset' || typeof claims.sub !== 'string') throw invalido;

  const usuario = await usuarios.buscarPorId(claims.sub);
  if (!usuario || usuario.credentialsVersion !== claims.ver) throw invalido;

  await transaction(async (tx) => {
    await usuarios.trocarSenha(usuario.id, await hashSenha(novaSenha), tx);
    await sessoes.revogarSessoesDoUsuario(usuario.id, MOTIVO.trocaDeSenha, tx);
  });
}

/** O `user` do contrato. `accounts` fica vazio até existir conexão com o TikTok. */
export async function montarSessao(usuario: Usuario) {
  const identidades = await usuarios.listarIdentidades(usuario.id);
  return {
    user: {
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      emailVerified: usuario.emailVerified,
      avatarUrl: usuario.avatarUrl,
      hasPassword: usuario.passwordHash !== null,
      identities: identidades.map((i) => ({
        provider: i.provider,
        email: i.email,
        linkedAt: i.linkedAt.toISOString(),
      })),
      acceptedTermsVersion: usuario.acceptedTermsVersion,
    },
    accounts: [] as const,
  };
}
