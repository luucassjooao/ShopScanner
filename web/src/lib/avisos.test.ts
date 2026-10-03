import { describe, expect, it } from 'vitest';
import type { NotificationSettings, Order, Plan } from '@/api/schemas';
import { orders } from '@/mocks/adapters/tiktok';
import { comissaoPerdidaNosAvisos, derivarAvisos } from './avisos';

const tudoLigado: NotificationSettings = {
  orderSettled: true,
  orderFrozen: true,
  orderRefunded: true,
  goalReached: true,
  paceDrop: true,
  viewsDrop: true,
  postReminder: true,
  channels: { inApp: true, email: false },
};
const AGORA = Date.parse('2026-09-22T12:00:00Z');
const base = { planos: [] as Plan[], mes: '2026-09', agora: AGORA };
const doStatus = (s: Order['status']) => orders.filter((o) => o.status === s);

describe('derivarAvisos', () => {
  it('um aviso por pedido retido, reembolsado ou liquidado, respeitando as preferências', () => {
    const pedidos = [...doStatus('FROZEN'), ...doStatus('REFUNDED'), ...doStatus('TO_SETTLE')];
    const todos = derivarAvisos({ ...base, settings: tudoLigado, pedidosRecentes: pedidos });
    expect(todos.filter((a) => a.tipo === 'orderFrozen')).toHaveLength(1);
    expect(todos.filter((a) => a.tipo === 'orderRefunded')).toHaveLength(7);
    expect(
      todos.some((a) => a.orderId && doStatus('TO_SETTLE').some((o) => o.id === a.orderId)),
    ).toBe(false);

    const semReembolso = derivarAvisos({
      ...base,
      settings: { ...tudoLigado, orderRefunded: false },
      pedidosRecentes: pedidos,
    });
    expect(semReembolso.some((a) => a.tipo === 'orderRefunded')).toBe(false);
    // Comissão que saiu do previsto: estimada de retidos + reembolsados (181,67 nos mocks).
    expect(comissaoPerdidaNosAvisos(todos, pedidos)).toBe('181.67');
  });

  it('meta: só o marco mais alto atingido, em 80% ou 100%', () => {
    // A meta mede o GMV elegível, o mesmo número da barra do Início.
    const meta = (gmvEligible: string) =>
      derivarAvisos({
        ...base,
        settings: tudoLigado,
        pedidosRecentes: [],
        resumoMes: { gmvEligible, goal: { gmv: '10000.00', commission: null } },
      }).filter((a) => a.tipo === 'goalReached');
    expect(meta('7999.99')).toHaveLength(0);
    expect(meta('8000.00').map((a) => a.id)).toEqual(['goalReached-2026-09-80']);
    expect(meta('12000.00').map((a) => a.id)).toEqual(['goalReached-2026-09-100']);
  });

  it('queda de ritmo a partir de 30% contra os 7 dias anteriores', () => {
    const ritmo = (atual: string) =>
      derivarAvisos({
        ...base,
        settings: tudoLigado,
        pedidosRecentes: [],
        gmvSemana: atual,
        gmvSemanaAnterior: '1000.00',
      }).filter((a) => a.tipo === 'paceDrop');
    expect(ritmo('701.00')).toHaveLength(0);
    expect(ritmo('700.00')).toHaveLength(1);
  });

  it('lembra de postar o que está marcado para as próximas 24 horas', () => {
    const plano = (scheduledFor: string, status: Plan['status'] = 'EDITED'): Plan => ({
      id: scheduledFor,
      title: 'Pauta',
      productId: null,
      scheduledFor,
      status,
      videoId: null,
      script: null,
      notes: null,
      createdAt: scheduledFor,
      updatedAt: scheduledFor,
    });
    const avisos = derivarAvisos({
      ...base,
      settings: tudoLigado,
      pedidosRecentes: [],
      planos: [
        plano('2026-09-22T20:00:00Z'),
        plano('2026-09-24T20:00:00Z'),
        plano('2026-09-22T21:00:00Z', 'POSTED'),
      ],
    });
    expect(avisos.filter((a) => a.tipo === 'postReminder')).toHaveLength(1);
  });
});
