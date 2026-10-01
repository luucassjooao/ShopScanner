import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from '../src/lib/db.ts';

const arquivo = join(dirname(fileURLToPath(import.meta.url)), '../db/seed.sql');
await sql.unsafe(await readFile(arquivo, 'utf8')).simple();
console.log('seed aplicado.');
await sql.end();
