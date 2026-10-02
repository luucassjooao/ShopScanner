import { randomBytes } from 'node:crypto';
import { env } from '../config/env.ts';
import { AppError } from '../lib/errors.ts';
import * as tiktok from '../lib/tiktok.ts';
import * as conexoes from '../repositories/connections.ts';
import type { TipoDeConexao } from '../repositories/connections.ts';

/** O `accounts` do contrato. Datas em ISO UTC, como tudo que sai daqui. */
export async function contasDoUsuario(userId: string) {
  const contas = await conexoes.listarContas(userId);
  return contas.map((c) => ({
    id: c.id,
    username: c.username,
    avatarUrl: c.avatarUrl,
    shopConnected: c.shopConnected,
    connectedAt: c.connectedAt.toISOString(),
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
  }));
}

export function iniciarTiktok(kind: TipoDeConexao) {
  if (kind === 'SHOP' && !env.TIKTOK_SHOP_ENABLED) {
    throw new AppError(
      503,
      'TIKTOK_SHOP_INDISPONIVEL',
      'Os pedidos do TikTok Shop ainda não liberaram para o Brasil',
    );
  }
  const state = randomBytes(32).toString('base64url');
  const { verifier, challenge } = tiktok.desafioPkce();
  return { authorizeUrl: tiktok.urlDeAutorizacao({ state, challenge }), state, verifier };
}

export async function concluirTiktok(dados: {
  userId: string;
  kind: TipoDeConexao;
  code: string;
  verifier: string;
}) {
  const token = await tiktok.trocarCodigo(dados.code, dados.verifier);
  // Nome e foto são enfeite: se a chamada falhar, a conexão vale do mesmo jeito.
  const perfil = await tiktok.dadosDoUsuario(token.accessToken);

  return conexoes.salvarConexao({
    userId: dados.userId,
    kind: dados.kind,
    providerUserId: token.openId,
    username: perfil.username,
    avatarUrl: perfil.avatarUrl,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    scopes: token.scopes,
  });
}

export async function desconectar(id: string, userId: string) {
  const apagadas = await conexoes.desconectar(id, userId);
  if (apagadas === 0) throw AppError.naoEncontrado('Conexão não encontrada');
}
