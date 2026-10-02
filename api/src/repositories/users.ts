import { z } from 'zod';
import { many, sql, type Executor } from '../lib/db.ts';

const linha = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string().nullable(),
  email_verified_at: z.date().nullable(),
  password_hash: z.string().nullable(),
  avatar_url: z.string().nullable(),
  accepted_terms_version: z.string().nullable(),
  credentials_version: z.number().int(),
  created_at: z.date(),
});

type Linha = z.infer<typeof linha>;

export type Usuario = {
  id: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  passwordHash: string | null;
  avatarUrl: string | null;
  acceptedTermsVersion: string | null;
  credentialsVersion: number;
  createdAt: Date;
};

/** Mapper explícito: é aqui que snake_case do banco vira camelCase do contrato. */
function mapear(l: Linha): Usuario {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    emailVerified: l.email_verified_at !== null,
    passwordHash: l.password_hash,
    avatarUrl: l.avatar_url,
    acceptedTermsVersion: l.accepted_terms_version,
    credentialsVersion: l.credentials_version,
    createdAt: l.created_at,
  };
}

const colunas = () => sql`id, name, email, email_verified_at, password_hash, avatar_url,
                    accepted_terms_version, credentials_version, created_at`;

export async function criar(
  dados: { name: string; email: string; passwordHash: string; acceptedTermsVersion: string },
  db: Executor = sql,
): Promise<Usuario> {
  const linhas = await many(
    linha,
    db`insert into users (name, email, password_hash, accepted_terms_version)
       values (${dados.name}, ${dados.email}, ${dados.passwordHash}, ${dados.acceptedTermsVersion})
       returning ${colunas()}`,
  );
  return mapear(linhas[0]!);
}

/** Conta nascida do Google: sem senha e com o e-mail já verificado pelo provedor. */
export async function criarComGoogle(
  dados: { name: string; email: string },
  db: Executor = sql,
): Promise<Usuario> {
  const linhas = await many(
    linha,
    db`insert into users (name, email, email_verified_at)
       values (${dados.name}, ${dados.email}, now())
       returning ${colunas()}`,
  );
  return mapear(linhas[0]!);
}

export async function marcarEmailVerificado(id: string, db: Executor = sql): Promise<void> {
  await db`update users set email_verified_at = coalesce(email_verified_at, now()),
                            updated_at = now()
            where id = ${id}`;
}

export async function buscarPorEmail(email: string, db: Executor = sql): Promise<Usuario | null> {
  const linhas = await many(
    linha,
    db`select ${colunas()} from users where email = ${email} and deleted_at is null`,
  );
  return linhas[0] ? mapear(linhas[0]) : null;
}

export async function buscarPorId(id: string, db: Executor = sql): Promise<Usuario | null> {
  const linhas = await many(
    linha,
    db`select ${colunas()} from users where id = ${id} and deleted_at is null`,
  );
  return linhas[0] ? mapear(linhas[0]) : null;
}

/** Troca a senha e invalida tudo que foi emitido com a versão anterior. */
export async function trocarSenha(
  id: string,
  passwordHash: string,
  db: Executor = sql,
): Promise<Usuario> {
  const linhas = await many(
    linha,
    db`update users
          set password_hash = ${passwordHash},
              credentials_version = credentials_version + 1,
              updated_at = now()
        where id = ${id} and deleted_at is null
        returning ${colunas()}`,
  );
  return mapear(linhas[0]!);
}

const linhaIdentidade = z.object({
  provider: z.literal('GOOGLE'),
  email: z.string().nullable(),
  created_at: z.date(),
});

export type Identidade = { provider: 'GOOGLE'; email: string | null; linkedAt: Date };

export async function buscarIdentidade(
  provider: 'GOOGLE',
  providerUserId: string,
  db: Executor = sql,
): Promise<{ userId: string } | null> {
  const linhas = await many(
    z.object({ user_id: z.uuid() }),
    db`select user_id from auth_identities
        where provider = ${provider} and provider_user_id = ${providerUserId}`,
  );
  return linhas[0] ? { userId: linhas[0].user_id } : null;
}

export async function criarIdentidade(
  dados: { userId: string; provider: 'GOOGLE'; providerUserId: string; email: string | null },
  db: Executor = sql,
): Promise<void> {
  await db`insert into auth_identities (user_id, provider, provider_user_id, email)
           values (${dados.userId}, ${dados.provider}, ${dados.providerUserId}, ${dados.email})`;
}

/** Devolve quantas apagou: 0 significa que não havia vínculo. */
export async function removerIdentidade(
  userId: string,
  provider: 'GOOGLE',
  db: Executor = sql,
): Promise<number> {
  const linhas = await db`delete from auth_identities
                           where user_id = ${userId} and provider = ${provider}
                           returning id`;
  return linhas.length;
}

export async function listarIdentidades(userId: string, db: Executor = sql): Promise<Identidade[]> {
  const linhas = await many(
    linhaIdentidade,
    db`select provider, email, created_at from auth_identities
        where user_id = ${userId} order by created_at`,
  );
  return linhas.map((l) => ({ provider: l.provider, email: l.email, linkedAt: l.created_at }));
}
