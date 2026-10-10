import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { COOKIE_ACESSO } from '../config/constants.ts';
import { sql } from '../lib/db.ts';
import { AMBIENTE_DE_TESTE } from '../test/env.ts';
import { comCookies, cookiesDe, CSRF, limparBanco } from '../test/helpers.ts';

/**
 * Os números daqui são os **totais de referência** do CLAUDE.md da raiz. Se um
 * deles mudar sem a tabela mudar junto, a API é que está errada.
 */

const CONTA = '00000000-0000-0000-0000-0000000000a1';
const PERIODO = `accountId=${CONTA}&from=2000-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z`;

const app = await buildApp();
let autenticado: Record<string, string>;

function semear(script: string) {
  execFileSync(process.execPath, [script], {
    env: { ...process.env, ...AMBIENTE_DE_TESTE },
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  await limparBanco();
  semear('scripts/seed.ts');
  semear('scripts/seed-from-mocks.ts');

  const entrada = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: CSRF,
    payload: { email: 'demo@shopscanner.app', password: 'demo-shopscanner' },
  });
  expect(entrada.statusCode).toBe(200);
  autenticado = comCookies({ [COOKIE_ACESSO]: cookiesDe(entrada)[COOKIE_ACESSO] }) as Record<
    string,
    string
  >;
});
afterAll(() => app.close());

const pegar = (url: string) => app.inject({ method: 'GET', url, headers: autenticado });

describe('contas', () => {
  it('hasSales é true com pedido de arquivo, sem nenhuma conexão de Shop', async () => {
    const contas = (await pegar('/accounts')).json();
    const demo = contas.find((c: { id: string }) => c.id === CONTA);
    expect(demo.shopConnected).toBe(false);
    expect(demo.hasSales).toBe(true);
  });

  it('hasSales é false em conta sem pedido nenhum', async () => {
    const SEM_PEDIDO = '00000000-0000-0000-0000-0000000000b9';
    await sql`insert into provider_connections
                (id, user_id, provider, kind, provider_user_id, username, access_token, scopes)
              values (${SEM_PEDIDO}, '00000000-0000-0000-0000-000000000001', 'TIKTOK', 'VIDEOS',
                      'sem-pedido', '@sem.pedido', null, '{}')`;
    try {
      const contas = (await pegar('/accounts')).json();
      const nova = contas.find((c: { id: string }) => c.id === SEM_PEDIDO);
      expect(nova.hasSales).toBe(false);
    } finally {
      await sql`delete from provider_connections where id = ${SEM_PEDIDO}`;
    }
  });
});

describe('resumo', () => {
  it('reproduz os totais de referência dos mocks', async () => {
    const res = await pegar(`/summary?${PERIODO}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      gmv: '11378.50',
      ordersCount: 80,
      unitsSold: 115,
      avgTicket: '142.23',
      commissionEstimated: '1424.55',
      commissionToReceive: '1023.89',
      commissionSettled: '181.22',
    });
  });

  it('separa o GMV elegível do que ainda não conta', async () => {
    const r = (await pegar(`/summary?${PERIODO}`)).json();
    // Elegível é só TO_SETTLE e SETTLED; o resto aparece na linha de fora.
    const soma = (a: string, b: string) =>
      ((BigInt(a.replace('.', '')) + BigInt(b.replace('.', ''))) / 100n).toString();
    expect(soma(r.gmvEligible, r.gmvIneligible)).toBe('11378');
    expect(Number(r.gmvEligible)).toBeGreaterThan(Number(r.gmvIneligible));
  });

  it('quebra por status, por canal, por dia e lista os maiores produtos', async () => {
    const r = (await pegar(`/summary?${PERIODO}`)).json();
    const porStatus = Object.fromEntries(
      r.byStatus.map((s: { status: string; gmv: string }) => [s.status, s.gmv]),
    );
    expect(Object.keys(porStatus).sort()).toEqual([
      'AWAITING_PAYMENT',
      'FROZEN',
      'REFUNDED',
      'SETTLED',
      'TO_SETTLE',
    ]);
    expect(r.byChannel.length).toBeGreaterThan(0);
    expect(r.byDay[0]).toMatchObject({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(r.topProducts).toHaveLength(5);
    expect(r.goal).toBeNull();
  });

  it('não entrega resumo de conta que não é da pessoa', async () => {
    const res = await pegar(
      `/summary?accountId=00000000-0000-0000-0000-00000000ffff&from=2000-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z`,
    );
    expect(res.statusCode).toBe(404);
  });
});

describe('pedidos', () => {
  it('pagina com total separado e devolve a procedência', async () => {
    const res = await pegar(`/orders?${PERIODO}&page=1&pageSize=10`);
    const corpo = res.json();
    expect(corpo.total).toBe(80);
    expect(corpo.items).toHaveLength(10);
    expect(corpo.items[0]).toMatchObject({
      source: 'FILE',
      sourceAt: '2026-10-01T09:00:00.000Z',
      currency: 'BRL',
    });
    expect(corpo.items[0].skus[0].rates).toMatchObject({ standard: expect.any(Number) });
    expect(corpo.items[0].skus[0].lineNo).toBeGreaterThanOrEqual(0);
  });

  it('anda a lista inteira pelo cursor, sem repetir pedido', async () => {
    const vistos = new Set<string>();
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const url: string = `/orders?${PERIODO}&pageSize=25${cursor ? `&cursor=${cursor}` : ''}`;
      const corpo = (await pegar(url)).json();
      for (const pedido of corpo.items) vistos.add(pedido.id);
      cursor = corpo.nextCursor;
      if (!cursor) break;
    }
    expect(vistos.size).toBe(80);
  });

  it('filtra por status e por canal', async () => {
    const liquidados = (await pegar(`/orders?${PERIODO}&status=SETTLED`)).json();
    expect(liquidados.total).toBe(13);
    const video = (await pegar(`/orders?${PERIODO}&channel=VIDEO`)).json();
    expect(video.total).toBeGreaterThan(0);
    expect(video.total).toBeLessThan(80);
  });

  it('mantém as duas linhas do pedido que repete o id do SKU', async () => {
    const res = await pegar('/orders/575059629618826862');
    expect(res.statusCode).toBe(200);
    const skus = res.json().skus;
    expect(skus).toHaveLength(2);
    expect(skus[0].id).toBe(skus[1].id);
    expect([skus[0].quantity, skus[1].quantity].sort()).toEqual([1, 2]);
    // Mesmo id de SKU, duas linhas: lineNo é a chave que separa as duas, cru a partir de 0.
    expect([skus[0].lineNo, skus[1].lineNo].sort()).toEqual([0, 1]);
    expect(res.json().statusHistory.length).toBeGreaterThan(0);
  });
});

describe('vídeos e produtos', () => {
  it('lista vídeos com venda', async () => {
    const corpo = (await pegar(`/videos?${PERIODO}&sort=views`)).json();
    expect(corpo.total).toBe(14);
    expect(corpo.items[0].views).toBeGreaterThanOrEqual(corpo.items[1].views);
    const comVenda = corpo.items.find((v: { gmv: string | null }) => v.gmv !== null);
    expect(comVenda.gmv).toMatch(/^\d+\.\d{2}$/);
  });

  it('venda ligada ao vídeo aparece sem nenhuma conexão de Shop; vídeo sem venda sai nulo', async () => {
    const corpo = (await pegar(`/videos?${PERIODO}`)).json();
    // A venda vem do arquivo: a ausência de Shop conectado não a esconde.
    const comVenda = corpo.items.find((v: { gmv: string | null }) => v.gmv !== null);
    expect(comVenda).toBeDefined();
    // Vídeo sem venda ligada sai nulo, nunca zero.
    for (const video of corpo.items) {
      if (video.gmv === null) {
        expect(video.commission).toBeNull();
        expect(video.gpm).toBeNull();
      } else {
        expect(Number(video.gmv)).toBeGreaterThan(0);
      }
    }
    const detalhe = (await pegar(`/videos/${comVenda.id}`)).json();
    expect(detalhe.gmv).toBe(comVenda.gmv);
    expect(detalhe.snapshots.length).toBeGreaterThan(0);
  });

  it('agrega produtos e bate com os maiores do resumo', async () => {
    const resumo = (await pegar(`/summary?${PERIODO}`)).json();
    const corpo = (await pegar(`/products?${PERIODO}&sort=gmv&pageSize=5`)).json();
    expect(corpo.items[0].productId).toBe(resumo.topProducts[0].productId);
    expect(corpo.items[0].gmv).toBe(resumo.topProducts[0].gmv);
    expect(corpo.items[0]).toMatchObject({
      commissionRate: expect.any(Number),
      ordersCount: expect.any(Number),
      topChannel: expect.any(String),
    });
    expect(corpo.total).toBeGreaterThan(5);
  });

  it('detalha o produto com os vídeos que o promoveram', async () => {
    const corpo = (await pegar(`/products?${PERIODO}&sort=gmv`)).json();
    const res = await pegar(`/products/${corpo.items[0].productId}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      productId: corpo.items[0].productId,
      videos: expect.any(Array),
    });
  });
});
