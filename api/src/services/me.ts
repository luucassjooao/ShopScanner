import { sql } from '../lib/db.ts';
import { listarMetas, listarPlanos, avisos } from './planning.ts';
import { montarSessao } from './auth.ts';
import * as pedidos from '../repositories/orders.ts';
import * as videosRepo from '../repositories/videos.ts';
import type { Usuario } from '../repositories/users.ts';

const TUDO = { from: new Date(0), to: new Date('2100-01-01T00:00:00Z') };

/**
 * `GET /me/export`: tudo que é da pessoa, em JSON. Sem token e sem hash de
 * senha — exportar dado pessoal não é exportar credencial.
 */
export async function exportar(usuario: Usuario) {
  const { user, accounts } = await montarSessao(usuario);
  const porConta = await Promise.all(
    accounts.map(async (conta) => {
      const periodo = { accountId: conta.id, ...TUDO };
      const [linhas, itens, videos] = await Promise.all([
        pedidos.listar(periodo, {}, { limite: 100000, offset: 0 }),
        sql`select * from order_skus where account_id = ${conta.id} order by order_id, id`,
        videosRepo.listar(periodo, { comShop: true, ordem: 'postedAt', limite: 100000, offset: 0 }),
      ]);
      return { account: conta, orders: linhas, orderSkus: itens, videos };
    }),
  );

  return {
    exportedAt: new Date().toISOString(),
    user,
    accounts,
    data: porConta,
    plans: await listarPlanos(usuario.id),
    goals: await listarMetas(usuario.id),
    notifications: await avisos(usuario.id),
  };
}

/**
 * `DELETE /me`: apaga de verdade. O cascata leva sessões, identidades,
 * conexões (com os tokens), pedidos, vídeos, produtos, pautas e metas.
 */
export async function excluirConta(userId: string) {
  await sql`delete from users where id = ${userId}`;
}
