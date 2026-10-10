import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.ts';
import * as auth from '../services/auth.ts';
import * as avatar from '../services/avatar.ts';
import { definirCookiesDeSessao, limparCookiesDeSessao } from '../lib/cookies.ts';
import * as me from '../services/me.ts';

const senha = z.object({
  // Opcional de propósito: conta criada pelo Google ainda não tem senha atual.
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200),
});

export async function definirSenha(request: FastifyRequest, reply: FastifyReply) {
  const dados = senha.parse(request.body);
  const tokens = await auth.definirSenha(request.autenticado!.usuario, dados, {
    userAgent: request.headers['user-agent'] ?? null,
    ip: request.ip || null,
  });
  // A sessão antiga morreu junto com as outras; esta aba segue com a nova.
  definirCookiesDeSessao(reply, tokens);
  return reply.status(204).send();
}

const perfil = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().max(255).optional(),
  acceptedTermsVersion: z.string().min(1).max(40).optional(),
  // Exigida pelo service só quando há senha e o e-mail muda.
  currentPassword: z.string().min(1).max(200).optional(),
});

/** `PATCH /me`: devolve o `SessionUser`. Se o e-mail mudou, a sessão nova vem em cookie. */
export async function atualizarPerfil(request: FastifyRequest, reply: FastifyReply) {
  const dados = perfil.parse(request.body);
  const { usuario, tokens } = await me.atualizarPerfil(request.autenticado!.usuario, dados, {
    userAgent: request.headers['user-agent'] ?? null,
    ip: request.ip || null,
  });
  if (tokens) definirCookiesDeSessao(reply, tokens);
  return reply.send(await auth.montarUsuario(usuario));
}

export async function exportar(request: FastifyRequest, reply: FastifyReply) {
  const dados = await me.exportar(request.autenticado!.usuario);
  return reply.header('content-disposition', 'attachment; filename="shopscanner.json"').send(dados);
}

export async function excluirConta(request: FastifyRequest, reply: FastifyReply) {
  await me.excluirConta(request.autenticado!.usuario.id);
  limparCookiesDeSessao(reply);
  return reply.status(204).send();
}

/** `POST /me/avatar`: multipart, campo `file`. A imagem é conferida pelos bytes no service. */
export async function enviarAvatar(request: FastifyRequest, reply: FastifyReply) {
  let parte;
  try {
    parte = await request.file();
  } catch (erro) {
    if ((erro as { code?: string }).code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
      throw AppError.validacao('Envie a imagem como multipart, no campo file');
    }
    throw erro;
  }
  if (!parte || parte.fieldname !== 'file') {
    throw AppError.validacao('Envie a imagem no campo file');
  }
  let conteudo: Buffer;
  try {
    conteudo = await parte.toBuffer();
  } catch (erro) {
    // Passou do teto geral do multipart: é imagem grande demais, não erro de servidor.
    if ((erro as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      throw new AppError(400, 'IMAGEM_MUITO_GRANDE', 'Imagem acima de 2 MB');
    }
    throw erro;
  }
  return reply.send(await avatar.trocar(request.autenticado!.usuario.id, conteudo));
}

/**
 * `GET /me/avatar`. Autenticado por cookie porque é carregado em `<img src>`, que é
 * subrecurso: o cookie `SameSite=Lax` só vai se a API e o front forem o mesmo site
 * (porta não separa site; `api.dominio` e `dominio` são o mesmo site). Se a API um
 * dia for para outro domínio registrável, o avatar some sem erro óbvio: é esta a
 * causa a procurar. O `Cross-Origin-Resource-Policy: same-site` abaixo sobrescreve o
 * `same-origin` que o helmet põe por padrão, senão o navegador bloqueia a imagem
 * vinda da porta do front.
 */
export async function lerAvatar(request: FastifyRequest, reply: FastifyReply) {
  const linha = await avatar.ler(request.autenticado!.usuario.id);
  return reply
    .header('content-type', linha.mime)
    .header('cache-control', 'private, max-age=31536000, immutable')
    .header('cross-origin-resource-policy', 'same-site')
    .send(linha.content);
}
