import { AppError } from '../lib/errors.ts';
import * as repo from '../repositories/planning.ts';
import type { LinhaAvisos, LinhaPlano } from '../repositories/planning.ts';
import { conferirConta } from './bi.ts';

function mapearPlano(p: LinhaPlano) {
  return {
    id: p.id,
    title: p.title,
    productId: p.product_id,
    scheduledFor: p.scheduled_for?.toISOString() ?? null,
    status: p.status,
    videoId: p.video_id,
    script: p.script,
    notes: p.notes,
    createdAt: p.created_at.toISOString(),
    updatedAt: p.updated_at.toISOString(),
  };
}

export async function listarPlanos(userId: string) {
  return (await repo.listarPlanos(userId)).map(mapearPlano);
}

export async function criarPlano(userId: string, dados: repo.EntradaPlano) {
  return mapearPlano(await repo.criarPlano(userId, dados));
}

export async function atualizarPlano(
  userId: string,
  id: string,
  dados: Partial<repo.EntradaPlano>,
) {
  const linha = await repo.atualizarPlano(userId, id, dados);
  if (!linha) throw AppError.naoEncontrado('Pauta não encontrada');
  return mapearPlano(linha);
}

export async function apagarPlano(userId: string, id: string) {
  if ((await repo.apagarPlano(userId, id)) === 0)
    throw AppError.naoEncontrado('Pauta não encontrada');
}

export async function listarMetas(userId: string) {
  return (await repo.listarMetas(userId)).map((m) => ({
    accountId: m.account_id,
    month: m.month,
    gmv: m.gmv,
    commission: m.commission,
  }));
}

export async function salvarMeta(
  userId: string,
  dados: { accountId: string; month: string; gmv: string | null; commission: string | null },
) {
  await conferirConta(userId, dados.accountId);
  const m = await repo.salvarMeta(dados);
  return { accountId: m.account_id, month: m.month, gmv: m.gmv, commission: m.commission };
}

function mapearAvisos(a: LinhaAvisos) {
  return {
    orderSettled: a.order_settled,
    orderFrozen: a.order_frozen,
    orderRefunded: a.order_refunded,
    goalReached: a.goal_reached,
    paceDrop: a.pace_drop,
    viewsDrop: a.views_drop,
    postReminder: a.post_reminder,
    channels: { inApp: a.channel_in_app, email: a.channel_email },
  };
}

export type Avisos = ReturnType<typeof mapearAvisos>;

export async function avisos(userId: string) {
  return mapearAvisos(await repo.preferencias(userId));
}

export async function salvarAvisos(userId: string, a: Avisos) {
  return mapearAvisos(
    await repo.salvarPreferencias(userId, {
      order_settled: a.orderSettled,
      order_frozen: a.orderFrozen,
      order_refunded: a.orderRefunded,
      goal_reached: a.goalReached,
      pace_drop: a.paceDrop,
      views_drop: a.viewsDrop,
      post_reminder: a.postReminder,
      channel_in_app: a.channels.inApp,
      // E-mail não existe no MVP: aceita o campo e guarda desligado.
      channel_email: false,
    }),
  );
}
