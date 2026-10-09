import { sql, transaction } from '../lib/db.ts';
import { AppError } from '../lib/errors.ts';
import { MOTIVO } from '../config/constants.ts';
import { listarMetas, listarPlanos, avisos } from './planning.ts';
import { conferirSenha } from '../lib/password.ts';
import { abrirSessao, montarSessao, type Contexto, type Tokens } from './auth.ts';
import * as pedidos from '../repositories/orders.ts';
import * as sessoes from '../repositories/sessions.ts';
import * as usuarios from '../repositories/users.ts';
import * as videosRepo from '../repositories/videos.ts';
import type { Usuario } from '../repositories/users.ts';

const TUDO = { from: new Date(0), to: new Date('2100-01-01T00:00:00Z') };

export type AtualizacaoPerfil = {
  name?: string;
  email?: string;
  acceptedTermsVersion?: string;
  currentPassword?: string;
};

/**
 * `PATCH /me`. Nome e aceite dos termos são dados comuns. E-mail é credencial:
 * trocá-lo derruba as outras sessões, como a troca de senha. Esta aba ganha
 * sessão nova, para a pessoa não ser expulsa da tela em que está.
 *
 * Com senha, trocar o e-mail exige a senha atual. Sem isso, uma sessão
 * sequestrada troca o e-mail, pede recuperação e fica com a conta. Quem só tem
 * Google não tem senha para pedir, então troca pela sessão.
 */
export async function atualizarPerfil(
  usuario: Usuario,
  { currentPassword, ...dados }: AtualizacaoPerfil,
  ctx: Contexto,
): Promise<{ usuario: Usuario; tokens: Tokens | null }> {
  const trocaEmail =
    dados.email !== undefined && dados.email.toLowerCase() !== usuario.email.toLowerCase();

  if (trocaEmail && usuario.passwordHash !== null) {
    const confere =
      currentPassword !== undefined && (await conferirSenha(usuario.passwordHash, currentPassword));
    if (!confere) throw new AppError(400, 'SENHA_ATUAL_INCORRETA', 'A senha atual não confere');
  }

  if (trocaEmail && (await usuarios.buscarPorEmail(dados.email!))) {
    throw new AppError(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail');
  }

  const atualizado = await transaction(async (tx) => {
    const novo = await usuarios.atualizarDados(usuario.id, dados, tx);
    if (!trocaEmail) return novo;
    const comEmailNovo = await usuarios.trocarEmail(usuario.id, dados.email!, tx);
    await sessoes.revogarSessoesDoUsuario(usuario.id, MOTIVO.trocaDeEmail, tx);
    return comEmailNovo;
  });

  return { usuario: atualizado, tokens: trocaEmail ? await abrirSessao(atualizado, ctx) : null };
}

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
