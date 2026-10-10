import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, ApiError } from '@/api/client';
import { fromCents, toCents } from '@/lib/money';
import {
  goal,
  productsPage as produtos,
  usuario,
  notificationSettings,
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
    // O topo do Início mostra o elegível; o resto vai na linha à parte. Somados, dão o bruto.
    expect(toCents(s.gmvEligible) + toCents(s.gmvIneligible)).toBe(toCents(s.gmv));
    const porStatus = new Map(s.byStatus.map((b) => [b.status, b.gmv]));
    expect(s.gmvEligible).toBe(
      fromCents(toCents(porStatus.get('TO_SETTLE')!) + toCents(porStatus.get('SETTLED')!)),
    );

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

  it('conta sem venda: pedidos vazios e vídeos com venda nula', async () => {
    db.vendasNaConta = false;
    const pedidos = await api.get('/orders', { schema: ordersPage, query: periodo });
    expect(pedidos.total).toBe(0);
    const v = await api.get('/videos', { schema: videosPage, query: periodo });
    expect(v.items.every((x) => x.gmv === null && x.gpm === null)).toBe(true);
  });

  it('o pedido com o mesmo SKU em duas linhas chega com lineNo distinto, a partir de 0', async () => {
    const p = await api.get('/orders', { schema: ordersPage, query: { ...periodo, pageSize: 100 } });
    const pedido = p.items.find((o) => o.id === '575059629618826862');
    expect(pedido!.skus.map((s) => s.id)).toEqual(['1732149525334652475', '1732149525334652475']);
    expect(pedido!.skus.map((s) => s.lineNo)).toEqual([0, 1]);
  });

  it('sem TikTok Shop conectado, mas com venda na conta: a venda aparece e vem do arquivo', async () => {
    db.shopConnected = false;
    const pedidos = await api.get('/orders', { schema: ordersPage, query: periodo });
    expect(pedidos.total).toBeGreaterThan(0);
    expect(pedidos.items.every((o) => o.source === 'FILE')).toBe(true);
    const v = await api.get('/videos', { schema: videosPage, query: periodo });
    expect(v.items.some((x) => x.gmv !== null)).toBe(true);
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

  it('busca e filtro por loja em pedidos e produtos', async () => {
    const r = await api.get('/orders', {
      schema: ordersPage,
      query: { ...periodo, q: 'ESCOVA', pageSize: 100 },
    });
    expect(r.total).toBeGreaterThan(0);
    expect(r.items.every((o) => o.skus.some((s) => /escova/i.test(s.name)))).toBe(true);
    const p = await api.get('/products', {
      schema: produtos,
      query: { ...periodo, shopName: 'TecnoLar Store' },
    });
    expect(p.items.every((x) => x.shopName === 'TecnoLar Store')).toBe(true);
    const reembolsos = await api.get('/products', {
      schema: produtos,
      query: { ...periodo, sort: 'refunds' },
    });
    expect(reembolsos.items[0]!.refundedUnits).toBeGreaterThanOrEqual(reembolsos.items[1]!.refundedUnits);
  });

  it('perfil, senha e preferências de aviso', async () => {
    const u = await api.patch('/me', { name: 'Carol' }, { schema: usuario });
    expect(u.name).toBe('Carol');
    await expect(
      api.put('/me/password', { currentPassword: 'x', newPassword: '12345678' }),
    ).rejects.toMatchObject({ code: 'invalido' });
    await api.put('/me/password', { currentPassword: 'senha-demo-123', newPassword: '12345678' });
    const n = await api.get('/me/notifications', { schema: notificationSettings });
    expect(n.channels).toEqual({ inApp: true, email: false });
    expect(n).toHaveProperty('viewsDrop');
  });
});
