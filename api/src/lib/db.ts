import postgres from 'postgres';
import type { z } from 'zod';
import { env, isProd } from '../config/env.ts';
import { AppError } from './errors.ts';

/**
 * Conexão única do processo. O driver é de template marcado: tudo que for
 * interpolado vira parâmetro, então SQL concatenado não acontece por descuido.
 *
 * `numeric` e `int8` voltam como texto por padrão neste driver — é o que o
 * contrato pede (dinheiro é texto decimal). Não ligue parser para number aqui.
 */
export const sql = postgres(env.DATABASE_URL, {
  max: isProd ? 10 : 5,
  onnotice: () => {},
});

/**
 * Quem executa SQL: a conexão ou a transação. Repositório aceita os dois, e é
 * por isso que a mesma função serve dentro e fora de `transaction()`.
 */
export type Executor = typeof sql | postgres.TransactionSql<Record<string, never>>;

/** Transação: o callback recebe o `sql` da transação e nada escapa dele. */
export const transaction = sql.begin.bind(sql);

/**
 * Id de linha: `z.guid()`, não `z.uuid()`. O tipo uuid do Postgres guarda
 * qualquer valor de 128 bits, e o `z.uuid()` do Zod exige bits de versão RFC —
 * seria mais estrito que o próprio banco, recusando id válido.
 */
function validar<T>(schema: z.ZodType<T>, row: unknown): T {
  const parsed = schema.safeParse(row);
  if (!parsed.success) {
    // Linha fora do schema é erro de verdade, não `any` solto circulando.
    const erro = new AppError(500, 'LINHA_INVALIDA', 'Erro interno');
    erro.cause = parsed.error;
    throw erro;
  }
  return parsed.data;
}

/** Lista validada linha a linha. */
export async function many<T>(
  schema: z.ZodType<T>,
  query: PromiseLike<readonly unknown[]>,
): Promise<T[]> {
  const rows = await query;
  return rows.map((row) => validar(schema, row));
}

/** Uma linha validada. Zero linhas é 404; mais de uma é erro de consulta. */
export async function one<T>(
  schema: z.ZodType<T>,
  query: PromiseLike<readonly unknown[]>,
): Promise<T> {
  const rows = await query;
  if (rows.length === 0) throw AppError.naoEncontrado();
  if (rows.length > 1) throw new AppError(500, 'MAIS_DE_UMA_LINHA', 'Erro interno');
  return validar(schema, rows[0]);
}

/** Usado só pelo /health. */
export async function ping(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
