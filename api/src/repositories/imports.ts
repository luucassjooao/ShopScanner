import { z } from 'zod';
import { many, sql } from '../lib/db.ts';

const linhaLote = z.object({
  id: z.guid(),
  account_id: z.guid(),
  kind: z.string(),
  file_name: z.string().nullable(),
  status: z.string(),
  created_at: z.date(),
  finished_at: z.date().nullable(),
  result: z
    .object({
      created: z.number(),
      updated: z.number(),
      unchanged: z.number(),
      skipped: z.number(),
    })
    .nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  columns_found: z.array(z.string()).nullable(),
  columns_missing: z.array(z.string()).nullable(),
});

export type LinhaLote = z.infer<typeof linhaLote>;

const colunas = () => sql`id, account_id, kind::text as kind, file_name, status::text as status,
                          created_at, finished_at, result, error_code, error_message,
                          columns_found, columns_missing`;

export async function criarLote(dados: {
  accountId: string;
  kind: string;
  fileName: string | null;
}) {
  const [linha] = await many(
    linhaLote,
    sql`insert into import_batches (account_id, kind, file_name)
        values (${dados.accountId}, ${dados.kind}::import_kind, ${dados.fileName})
        returning ${colunas()}`,
  );
  return linha!;
}

export async function guardarArquivo(loteId: string, conteudo: Buffer) {
  await sql`insert into import_files (import_id, content) values (${loteId}, ${conteudo})`;
}

export async function lerArquivo(loteId: string): Promise<Buffer | null> {
  const [linha] = await sql<{ content: Buffer }[]>`
    select content from import_files where import_id = ${loteId}`;
  return linha?.content ?? null;
}

export async function marcarFalhou(loteId: string, codigo: string, mensagem: string) {
  await sql`update import_batches
               set status = 'FAILED', finished_at = now(),
                   error_code = ${codigo}, error_message = ${mensagem}
             where id = ${loteId}`;
}

/** Pega o lote mais antigo ainda na fila. `skip locked` deixa dois processos não brigarem pelo mesmo. */
export async function reivindicarProximo(): Promise<LinhaLote | null> {
  const [linha] = await many(
    linhaLote,
    sql`update import_batches set status = 'PROCESSING'
         where id = (select id from import_batches where status = 'QUEUED'
                      order by created_at limit 1 for update skip locked)
        returning ${colunas()}`,
  );
  return linha ?? null;
}

export async function listar(
  filtro: { accountId: string; kind: string | null; status: string | null },
  pagina: { page: number; pageSize: number },
) {
  const [contagem] = await sql<{ total: number }[]>`
    select count(*)::int as total from import_batches
     where account_id = ${filtro.accountId}
       and (${filtro.kind}::text is null or kind::text = ${filtro.kind})
       and (${filtro.status}::text is null or status::text = ${filtro.status})`;

  const items = await many(
    linhaLote,
    sql`select ${colunas()} from import_batches
         where account_id = ${filtro.accountId}
           and (${filtro.kind}::text is null or kind::text = ${filtro.kind})
           and (${filtro.status}::text is null or status::text = ${filtro.status})
         order by created_at desc, id desc
         limit ${pagina.pageSize} offset ${(pagina.page - 1) * pagina.pageSize}`,
  );
  return { items, total: contagem!.total };
}

/** O lote só aparece para a conta da pessoa: qualquer outro id não existe. */
export async function buscar(userId: string, loteId: string): Promise<LinhaLote | null> {
  const [linha] = await many(
    linhaLote,
    sql`select ${colunas()} from import_batches
         where id = ${loteId}
           and account_id in (select id from provider_connections where user_id = ${userId})`,
  );
  return linha ?? null;
}
