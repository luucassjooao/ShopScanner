import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.ts';
import * as bi from '../services/bi.ts';
import * as imports from '../services/imports.ts';

const envio = z.object({ accountId: z.guid() });

const listagem = z.object({
  accountId: z.guid(),
  kind: z.enum(['FILE', 'SYNC', 'RECHECK']).optional(),
  status: z.enum(['QUEUED', 'PROCESSING', 'DONE', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const id = z.object({ id: z.guid() });

/**
 * `accountId` vem na query e é conferido contra a sessão antes de o corpo ser
 * lido: conta alheia responde 404 sem engolir o arquivo. Por isso não é campo do
 * multipart, cuja validação dependeria da ordem das partes.
 */
export async function enviar(request: FastifyRequest, reply: FastifyReply) {
  const { accountId } = envio.parse(request.query);
  await bi.conferirConta(request.autenticado!.usuario.id, accountId);

  let parte;
  try {
    parte = await request.file();
  } catch (erro) {
    if ((erro as { code?: string }).code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
      throw AppError.validacao('Envie o arquivo como multipart, no campo file');
    }
    throw erro;
  }
  if (!parte || parte.fieldname !== 'file') {
    throw AppError.validacao('Envie o arquivo no campo file');
  }

  // ponytail: o arquivo inteiro vai para a memória, até o teto de 50 MB. Upgrade:
  // gravar em disco ou em armazenamento de objeto se o volume de uploads crescer.
  let conteudo: Buffer | null = null;
  let grande = false;
  try {
    conteudo = await parte.toBuffer();
  } catch (erro) {
    if ((erro as { code?: string }).code !== 'FST_REQ_FILE_TOO_LARGE') throw erro;
    grande = true;
  }

  const importId = await imports.enviar(
    accountId,
    { nome: parte.filename, conteudo, grande },
    request.log,
  );
  return reply.status(201).send({ importId });
}

export async function listar(request: FastifyRequest, reply: FastifyReply) {
  const q = listagem.parse(request.query);
  await bi.conferirConta(request.autenticado!.usuario.id, q.accountId);
  return reply.send(
    await imports.listar(
      { accountId: q.accountId, kind: q.kind ?? null, status: q.status ?? null },
      { page: q.page, pageSize: q.pageSize },
    ),
  );
}

export async function buscar(request: FastifyRequest, reply: FastifyReply) {
  const { id: loteId } = id.parse(request.params);
  return reply.send(await imports.buscar(request.autenticado!.usuario.id, loteId));
}
