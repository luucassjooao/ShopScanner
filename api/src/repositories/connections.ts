import { z } from 'zod';
import { cifrar, VERSAO_DA_CHAVE } from '../lib/cripto.ts';
import { many, sql, type Executor } from '../lib/db.ts';

export type TipoDeConexao = 'VIDEOS' | 'SHOP';

const linhaConta = z.object({
  id: z.guid(),
  provider_user_id: z.string(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  connected_at: z.date(),
  last_synced_at: z.date().nullable(),
  expires_at: z.date().nullable(),
  shop_connected: z.boolean(),
  has_sales: z.boolean(),
});

export type Conta = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  shopConnected: boolean;
  /** Existe pedido nesta conta, de qualquer fonte: API ou arquivo. Independe do Shop. */
  hasSales: boolean;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  expiresAt: Date | null;
};

/**
 * Uma "conta" do contrato é a conexão de vídeos; `shopConnected` diz se a
 * mesma conta do TikTok também autorizou os pedidos.
 */
export async function listarContas(userId: string, db: Executor = sql): Promise<Conta[]> {
  const linhas = await many(
    linhaConta,
    db`select c.id, c.provider_user_id, c.username, c.avatar_url, c.connected_at,
              c.last_synced_at, c.expires_at,
              exists (select 1 from provider_connections s
                       where s.user_id = c.user_id and s.provider = c.provider
                         and s.kind = 'SHOP' and s.provider_user_id = c.provider_user_id
                         and s.revoked_at is null) as shop_connected,
              exists (select 1 from orders o where o.account_id = c.id) as has_sales
         from provider_connections c
        where c.user_id = ${userId} and c.provider = 'TIKTOK'
          and c.kind = 'VIDEOS' and c.revoked_at is null
        order by c.connected_at`,
  );
  return linhas.map((l) => ({
    id: l.id,
    username: l.username,
    avatarUrl: l.avatar_url,
    shopConnected: l.shop_connected,
    hasSales: l.has_sales,
    connectedAt: l.connected_at,
    lastSyncedAt: l.last_synced_at,
    expiresAt: l.expires_at,
  }));
}

/** A conta existe e é desta pessoa? Devolve também se o Shop está ligado. */
export async function buscarConta(
  userId: string,
  accountId: string,
  db: Executor = sql,
): Promise<{ id: string; shopConnected: boolean } | null> {
  const linhas = await many(
    z.object({ id: z.guid(), shop_connected: z.boolean() }),
    db`select c.id,
              exists (select 1 from provider_connections s
                       where s.user_id = c.user_id and s.provider = c.provider
                         and s.kind = 'SHOP' and s.provider_user_id = c.provider_user_id
                         and s.revoked_at is null) as shop_connected
         from provider_connections c
        where c.id = ${accountId} and c.user_id = ${userId} and c.revoked_at is null`,
  );
  return linhas[0] ? { id: linhas[0].id, shopConnected: linhas[0].shop_connected } : null;
}

/** Reconectar a mesma conta atualiza a linha: o token novo substitui o velho. */
export async function salvarConexao(
  dados: {
    userId: string;
    kind: TipoDeConexao;
    providerUserId: string;
    username: string | null;
    avatarUrl: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: string[];
  },
  db: Executor = sql,
): Promise<string> {
  const linhas = await many(
    z.object({ id: z.guid() }),
    db`insert into provider_connections
         (user_id, provider, kind, provider_user_id, username, avatar_url,
          access_token, refresh_token, key_version, scopes, expires_at, revoked_at)
       values
         (${dados.userId}, 'TIKTOK', ${dados.kind}, ${dados.providerUserId}, ${dados.username},
          ${dados.avatarUrl}, ${cifrar(dados.accessToken)},
          ${dados.refreshToken ? cifrar(dados.refreshToken) : null}, ${VERSAO_DA_CHAVE},
          ${dados.scopes}, ${dados.expiresAt}, null)
       on conflict (user_id, provider, kind, provider_user_id) do update
          set username = excluded.username,
              avatar_url = excluded.avatar_url,
              access_token = excluded.access_token,
              refresh_token = excluded.refresh_token,
              key_version = excluded.key_version,
              scopes = excluded.scopes,
              expires_at = excluded.expires_at,
              connected_at = now(),
              revoked_at = null
       returning id`,
  );
  return linhas[0]!.id;
}

/**
 * Desconectar apaga de verdade, junto com o token: a política de privacidade
 * promete não guardar dado de conta desconectada.
 */
export async function desconectar(id: string, userId: string): Promise<number> {
  const apagadas = await sql<{ kind: string; provider_user_id: string }[]>`
    delete from provider_connections
     where id = ${id} and user_id = ${userId}
     returning kind, provider_user_id`;
  const alvo = apagadas[0];
  if (!alvo) return 0;

  // Desligar os vídeos desliga a conta inteira: sem Display API, os pedidos
  // daquela conta ficariam órfãos.
  if (alvo.kind === 'VIDEOS') {
    await sql`delete from provider_connections
               where user_id = ${userId} and provider_user_id = ${alvo.provider_user_id}`;
  }
  return 1;
}
