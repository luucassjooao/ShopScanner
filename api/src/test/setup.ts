import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { AMBIENTE_DE_TESTE, DATABASE_URL_TESTE } from './env.ts';

/** Cria o banco de teste se faltar e aplica as migrações, uma vez por execução. */
export async function setup() {
  const url = new URL(DATABASE_URL_TESTE);
  const nome = url.pathname.slice(1);
  const manutencao = new URL(DATABASE_URL_TESTE);
  manutencao.pathname = '/postgres';

  const sql = postgres(manutencao.toString(), { max: 1, onnotice: () => {} });
  try {
    const existe = await sql`select 1 from pg_database where datname = ${nome}`;
    // CREATE DATABASE não aceita parâmetro; o nome vem de constante nossa.
    if (existe.length === 0) await sql.unsafe(`create database "${nome}"`);
  } catch (erro) {
    throw new Error(
      `Não consegui falar com o Postgres em ${url.host}. Suba o banco antes: docker compose up -d db`,
      { cause: erro },
    );
  } finally {
    await sql.end();
  }

  try {
    execFileSync(process.execPath, ['scripts/migrate.ts'], {
      env: { ...process.env, ...AMBIENTE_DE_TESTE },
      stdio: 'pipe',
    });
  } catch (erro) {
    const saida = (erro as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`Falha ao migrar o banco de teste.\n${saida}`, { cause: erro });
  }
}
