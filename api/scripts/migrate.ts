import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, transaction } from '../src/lib/db.ts';

const pasta = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const arquivos = (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort();

// Na primeira vez a tabela ainda não existe: isso é lista vazia, não erro.
const aplicadas = new Set(
  await sql<{ name: string }[]>`select name from schema_migrations`
    .then((rows) => rows.map((r) => r.name))
    .catch(() => []),
);

for (const arquivo of arquivos) {
  if (aplicadas.has(arquivo)) continue;
  const conteudo = await readFile(join(pasta, arquivo), 'utf8');

  // Arquivo inteiro e registro na mesma transação: ou aplica tudo, ou nada.
  // O lock serializa dois runners subindo juntos (acontece com docker compose).
  await transaction(async (tx) => {
    await tx`select pg_advisory_xact_lock(8172364)`;
    await tx.unsafe(conteudo).simple();
    await tx`insert into schema_migrations (name) values (${arquivo})`;
  });

  console.log(`aplicada  ${arquivo}`);
}

console.log(`${arquivos.length - aplicadas.size} migração(ões) aplicada(s), banco em dia.`);
await sql.end();
