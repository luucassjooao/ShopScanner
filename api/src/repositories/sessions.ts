import { z } from 'zod';
import { many, sql, type Executor } from '../lib/db.ts';

/* ---------------------------------------------------------------- sessions */

const linhaSessao = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  user_agent: z.string().nullable(),
  ip: z.string().nullable(),
  created_at: z.date(),
  last_used_at: z.date(),
  revoked_at: z.date().nullable(),
});

export type Sessao = {
  id: string;
  userId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
};

function mapearSessao(l: z.infer<typeof linhaSessao>): Sessao {
  return {
    id: l.id,
    userId: l.user_id,
    userAgent: l.user_agent,
    ip: l.ip,
    createdAt: l.created_at,
    lastUsedAt: l.last_used_at,
    revokedAt: l.revoked_at,
  };
}

const colunasSessao = () => sql`id, user_id, user_agent, ip, created_at, last_used_at, revoked_at`;

export async function criarSessao(
  dados: { userId: string; userAgent: string | null; ip: string | null },
  db: Executor = sql,
): Promise<Sessao> {
  const linhas = await many(
    linhaSessao,
    db`insert into sessions (user_id, user_agent, ip)
       values (${dados.userId}, ${dados.userAgent}, ${dados.ip}::inet)
       returning ${colunasSessao()}`,
  );
  return mapearSessao(linhas[0]!);
}

export async function buscarSessaoAtiva(id: string, db: Executor = sql): Promise<Sessao | null> {
  const linhas = await many(
    linhaSessao,
    db`select ${colunasSessao()} from sessions where id = ${id} and revoked_at is null`,
  );
  return linhas[0] ? mapearSessao(linhas[0]) : null;
}

export async function listarSessoesDoUsuario(
  userId: string,
  db: Executor = sql,
): Promise<Sessao[]> {
  const linhas = await many(
    linhaSessao,
    db`select ${colunasSessao()} from sessions
        where user_id = ${userId} and revoked_at is null
        order by last_used_at desc`,
  );
  return linhas.map(mapearSessao);
}

/** Devolve quantas sessões revogou: 0 significa que não era do usuário. */
export async function revogarSessao(
  id: string,
  userId: string,
  motivo: string,
  db: Executor = sql,
): Promise<number> {
  const linhas = await db`update sessions
        set revoked_at = now(), revoked_reason = ${motivo}
      where id = ${id} and user_id = ${userId} and revoked_at is null
      returning id`;
  return linhas.length;
}

export async function revogarSessoesDoUsuario(
  userId: string,
  motivo: string,
  db: Executor = sql,
): Promise<number> {
  const linhas = await db`update sessions
        set revoked_at = now(), revoked_reason = ${motivo}
      where user_id = ${userId} and revoked_at is null
      returning id`;
  return linhas.length;
}

export async function tocarSessao(id: string, db: Executor = sql): Promise<void> {
  await db`update sessions set last_used_at = now() where id = ${id}`;
}

/* ---------------------------------------------------------- refresh_tokens */

const linhaRefresh = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  family_id: z.uuid(),
  expires_at: z.date(),
  used_at: z.date().nullable(),
});

export type Refresh = {
  id: string;
  sessionId: string;
  familyId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

function mapearRefresh(l: z.infer<typeof linhaRefresh>): Refresh {
  return {
    id: l.id,
    sessionId: l.session_id,
    familyId: l.family_id,
    expiresAt: l.expires_at,
    usedAt: l.used_at,
  };
}

export async function criarRefresh(
  dados: { sessionId: string; familyId: string | null; tokenHash: Buffer; expiresAt: Date },
  db: Executor = sql,
): Promise<Refresh> {
  // family_id nulo: é o primeiro da família, então ela é o próprio id da linha.
  const linhas = await many(
    linhaRefresh,
    db`insert into refresh_tokens (session_id, family_id, token_hash, expires_at)
       values (
         ${dados.sessionId},
         coalesce(${dados.familyId}::uuid, gen_random_uuid()),
         ${dados.tokenHash},
         ${dados.expiresAt}
       )
       returning id, session_id, family_id, expires_at, used_at`,
  );
  return mapearRefresh(linhas[0]!);
}

export async function buscarRefreshPorHash(
  tokenHash: Buffer,
  db: Executor = sql,
): Promise<Refresh | null> {
  const linhas = await many(
    linhaRefresh,
    db`select id, session_id, family_id, expires_at, used_at
         from refresh_tokens where token_hash = ${tokenHash}`,
  );
  return linhas[0] ? mapearRefresh(linhas[0]) : null;
}

/**
 * Marca como usado só se ainda não estava. Devolve se conseguiu: é esta
 * condição que decide quem ganha quando dois refresh chegam juntos.
 */
export async function marcarRefreshUsado(id: string, db: Executor = sql): Promise<boolean> {
  const linhas = await db`update refresh_tokens set used_at = now()
                           where id = ${id} and used_at is null
                           returning id`;
  return linhas.length === 1;
}

export async function apontarSucessor(
  id: string,
  sucessorId: string,
  db: Executor = sql,
): Promise<void> {
  await db`update refresh_tokens set replaced_by_id = ${sucessorId} where id = ${id}`;
}

/** Queima a família inteira: é a resposta ao token reutilizado. */
export async function queimarFamilia(familyId: string, db: Executor = sql): Promise<void> {
  await db`update refresh_tokens set used_at = now()
            where family_id = ${familyId} and used_at is null`;
}
