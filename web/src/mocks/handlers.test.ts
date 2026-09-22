import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, ApiError } from '@/api/client';
import {
  goal,
  orderDetail,
  ordersPage,
  plan,
  productDetail,
  productsPage,
  sessao,
  summary,
  videoDetail,
  videosPage,
} from '@/api/schemas';
import { db, resetDb } from './handlers';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => resetDb());
afterAll(() => server.close());

const periodo = {
  accountId: 'acc_1',
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-09-30T23:59:59.999Z',
};

/** Toda resposta do MSW passa pelo mesmo Zod que a resposta do backend real vai passar. */
describe('handlers do MSW respeitam o contrato', () => {
  it('sessão, resumo, pedidos, vídeos e produtos', async () => {
    await api.get('/auth/session', { schema: sessao });

    const s = await api.get('/summary', { schema: summary, query: periodo });
    expect(s.gmv).toBe('11378.50');

    const p = await api.get('/orders', { schema: ordersPage, query: { ...periodo, pageSize: 100 } });
    expect(p.total).toBe(80);
    const d = await api.get(`/orders/${p.items[0].id}`, { schema: orderDetail });
    expect(d.statusHistory.length).toBeGreaterThan(0);

    const v = await api.get('/videos', { schema: videosPage, query: { ...periodo, sort: 'gmv' } });
    expect(v.total).toBe(14);
    await api.get(`/videos/${v.items[0].id}`, { schema: videoDetail });

    const pr = await api.get('/products', { schema: productsPage, query: periodo });
    expect(pr.total).toBe(10);
    await api.get(`/products/${pr.items[0].productId}`, { schema: productDetail });
  });

  it('filtra pedidos por status e período', async () => {
    const r = await api.get('/orders', {
      schema: ordersPage,
      query: { ...periodo, status: 'TO_SETTLE', pageSize: 100 },
    });
    expect(r.total).toBe(57);
    const vazio = await api.get('/orders', {
      schema: ordersPage,
      query: { ...periodo, from: '2027-01-01T00:00:00.000Z', to: '2027-01-31T00:00:00.000Z' },
    });
    expect(vazio.total).toBe(0);
  });

  it('sem TikTok Shop, vídeos vêm com venda nula', async () => {
    db.shopConnected = false;
    const v = await api.get('/videos', { schema: videosPage, query: periodo });
    expect(v.items.every((x) => x.gmv === null && x.gpm === null)).toBe(true);
  });

  it('planos e metas', async () => {
    const criado = await api.post(
      '/plans',
      {
        title: 'Review do protetor',
        productId: null,
        scheduledFor: null,
        status: 'IDEA',
        videoId: null,
        script: null,
        notes: null,
      },
      { schema: plan },
    );
    const editado = await api.patch(`/plans/${criado.id}`, { status: 'SCRIPT' }, { schema: plan });
    expect(editado.status).toBe('SCRIPT');

    const mes = new Date().toISOString().slice(0, 7);
    await api.put('/goals', { accountId: 'acc_1', month: mes, gmv: '15000.00', commission: null }, { schema: goal });
    const s = await api.get('/summary', { schema: summary, query: periodo });
    expect(s.goal).toEqual({ gmv: '15000.00', commission: null });
  });

  it('401 depois de sair; 404 para conta alheia', async () => {
    await api.post('/auth/logout');
    await expect(api.get('/auth/session', { schema: sessao })).rejects.toMatchObject({
      code: 'nao_autenticado',
    });
    resetDb();
    const e = await api
      .get('/summary', { schema: summary, query: { ...periodo, accountId: 'outra' } })
      .catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe('nao_encontrado');
  });
});
