import type { Money, NotificationSettings, Order, Plan, Summary } from '@/api/schemas';
import { formatMoeda as brl } from './format';
import { fromCents, toCents } from './money';
import { orderCommission, orderGmv } from './metrics';

/**
 * Avisos do sino, derivados no front (CLAUDE.md): não existe feed no backend.
 * Cada aviso tem um id estável, para lembrar o que já foi lido.
 */

export type TipoAviso = Exclude<keyof NotificationSettings, 'channels'>;

export interface Aviso {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  /** ISO; ordena do mais recente para o mais antigo. */
  quando: string;
  /** Pedido relacionado, para o link "Ver o pedido". */
  orderId?: string;
  detalhe?: string;
}

export interface EntradaAvisos {
  settings: NotificationSettings;
  /** Pedidos dos últimos 7 dias. */
  pedidosRecentes: Order[];
  /** Resumo do mês corrente (traz a meta). */
  resumoMes?: Pick<Summary, 'gmvEligible' | 'goal'>;
  /** GMV dos últimos 7 dias e dos 7 anteriores, para a queda de ritmo. */
  gmvSemana?: Money;
  gmvSemanaAnterior?: Money;
  planos: Plan[];
  mes: string; // AAAA-MM
  agora?: number;
}

/** ponytail: limiar fixo de queda de ritmo; vira preferência se as creators pedirem. */
const QUEDA_RITMO = 0.3;

export function derivarAvisos(e: EntradaAvisos): Aviso[] {
  const { settings: s } = e;
  const agora = e.agora ?? Date.now();
  const avisos: Aviso[] = [];

  const porStatus = {
    SETTLED: 'orderSettled',
    FROZEN: 'orderFrozen',
    REFUNDED: 'orderRefunded',
  } as const;
  for (const o of e.pedidosRecentes) {
    const tipo = porStatus[o.status as keyof typeof porStatus];
    if (!tipo || !s[tipo]) continue;
    const [sku] = o.skus;
    const produto = sku ? sku.name : 'um produto';
    const comissao = orderCommission(o).valor;
    const gmv = orderGmv(o);
    const textos = {
      orderSettled: {
        titulo: 'Comissão liquidada',
        texto: `A comissão de ${brl(comissao)} do pedido de ${produto} foi confirmada.`,
      },
      orderFrozen: {
        titulo: 'Pedido retido pela plataforma',
        texto: `O pedido de ${brl(gmv)} de ${produto} entrou em revisão e a comissão de ${brl(comissao)} saiu do previsto até a plataforma concluir a análise.`,
      },
      orderRefunded: {
        titulo: 'Pedido reembolsado',
        texto: `O pedido de ${brl(gmv)} de ${produto} foi reembolsado. A comissão de ${brl(comissao)} saiu do total a receber.`,
      },
    }[tipo];
    avisos.push({
      id: `${tipo}-${o.id}`,
      tipo,
      ...textos,
      quando: o.deliveredAt ?? o.createdAt,
      orderId: o.id,
      detalhe: sku ? sku.shopName : undefined,
    });
  }

  // Mede o mesmo número que a barra do Início: o elegível, não o bruto.
  const meta = e.resumoMes?.goal?.gmv;
  if (s.goalReached && meta && e.resumoMes && toCents(meta) > 0n) {
    const pct = Number((toCents(e.resumoMes.gmvEligible) * 100n) / toCents(meta));
    for (const marco of [100, 80]) {
      if (pct < marco) continue;
      avisos.push({
        id: `goalReached-${e.mes}-${marco}`,
        tipo: 'goalReached',
        titulo: marco === 100 ? 'Meta do mês batida' : 'Você chegou a 80% da meta',
        texto: `O GMV do mês está em ${brl(e.resumoMes.gmvEligible)}, de uma meta de ${brl(meta)}.`,
        quando: new Date(agora).toISOString(),
      });
      break; // só o marco mais alto
    }
  }

  if (s.paceDrop && e.gmvSemana && e.gmvSemanaAnterior) {
    const atual = toCents(e.gmvSemana);
    const antes = toCents(e.gmvSemanaAnterior);
    if (antes > 0n && Number(antes - atual) / Number(antes) >= QUEDA_RITMO) {
      const queda = Math.round((Number(antes - atual) / Number(antes)) * 100);
      avisos.push({
        id: `paceDrop-${new Date(agora).toISOString().slice(0, 10)}`,
        tipo: 'paceDrop',
        titulo: 'Suas vendas desaceleraram',
        texto: `Nos últimos 7 dias o GMV foi ${brl(e.gmvSemana)}, ${queda}% abaixo dos 7 dias anteriores (${brl(e.gmvSemanaAnterior)}).`,
        quando: new Date(agora).toISOString(),
      });
    }
  }

  if (s.postReminder) {
    const limite = agora + 24 * 3_600_000;
    for (const p of e.planos) {
      if (!p.scheduledFor || p.status === 'POSTED') continue;
      const t = Date.parse(p.scheduledFor);
      if (t < agora || t > limite) continue;
      avisos.push({
        id: `postReminder-${p.id}-${p.scheduledFor}`,
        tipo: 'postReminder',
        titulo: 'Tem post marcado para as próximas 24 horas',
        texto: `"${p.title}" está no seu planejamento.`,
        quando: new Date(agora).toISOString(),
      });
    }
  }

  // viewsDrop depende dos snapshots de cada vídeo; entra quando /videos trouxer a série.
  return avisos.sort((a, b) => b.quando.localeCompare(a.quando));
}

/** Comissão que saiu do previsto: retidos mais reembolsados. */
export function comissaoPerdidaNosAvisos(avisos: Aviso[], pedidos: Order[]): Money {
  const ids = new Set(
    avisos
      .filter((a) => a.tipo === 'orderFrozen' || a.tipo === 'orderRefunded')
      .map((a) => a.orderId),
  );
  return fromCents(
    pedidos
      .filter((o) => ids.has(o.id))
      .reduce((t, o) => t + toCents(orderCommission(o).valor), 0n),
  );
}
