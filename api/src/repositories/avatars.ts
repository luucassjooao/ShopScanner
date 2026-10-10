import { z } from 'zod';
import { many, sql } from '../lib/db.ts';

const linhaAvatar = z.object({
  content: z.instanceof(Buffer),
  mime: z.string(),
  hash: z.string(),
});

export type LinhaAvatar = z.infer<typeof linhaAvatar>;

/** Troca a foto e aponta `users.avatar_url` para o caminho novo, na mesma transação. */
export async function gravar(
  userId: string,
  dados: { content: Buffer; mime: string; hash: string },
) {
  await sql.begin(async (tx) => {
    await tx`insert into user_avatars (user_id, content, mime, hash)
             values (${userId}, ${dados.content}, ${dados.mime}, ${dados.hash})
             on conflict (user_id) do update set
               content = excluded.content, mime = excluded.mime,
               hash = excluded.hash, updated_at = now()`;
    await tx`update users set avatar_url = ${`/me/avatar?v=${dados.hash}`} where id = ${userId}`;
  });
}

/** Null quando a pessoa nunca enviou foto. */
export async function ler(userId: string): Promise<LinhaAvatar | null> {
  const [linha] = await many(
    linhaAvatar,
    sql`select content, mime, hash from user_avatars where user_id = ${userId}`,
  );
  return linha ?? null;
}
