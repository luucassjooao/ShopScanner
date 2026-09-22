import { describe, expect, it } from 'vitest';
import { commissionByStatus, commissionLost, isShopAdsSale, summarize } from '@/lib/metrics';
import { sumMoney } from '@/lib/money';
import { adaptVideo, orders, productDetail, rawVideos } from './tiktok';

/** Totais de referência dos mocks (CLAUDE.md → "Totais de referência"). */
describe('adaptador TikTok → contrato, conferido contra os totais dos mocks', () => {
  const skus = orders.flatMap((o) => o.skus);
  const s = summarize(orders);

  it('GMV, pedidos, linhas e itens', () => {
    expect(s.gmv).toBe('11378.50');
    expect(s.ordersCount).toBe(80);
    expect(skus).toHaveLength(90);
    expect(s.unitsSold).toBe(115);
    expect(s.avgTicket).toBe('142.23');
  });

  it('comissões conforme as definições dos números', () => {
    expect(s.commissionEstimated).toBe('1424.55');
    expect(s.commissionToReceive).toBe('1023.89');
    expect(s.commissionSettled).toBe('181.22');
    expect(commissionLost(orders)).toBe('181.67');
    expect(commissionByStatus(orders).AWAITING_PAYMENT).toBe('24.28');
  });

  it('status traduzidos para as chaves do contrato', () => {
    const contagem: Record<string, number> = {};
    for (const o of orders) contagem[o.status] = (contagem[o.status] ?? 0) + 1;
    expect(contagem).toEqual({
      TO_SETTLE: 57,
      SETTLED: 13,
      REFUNDED: 7,
      AWAITING_PAYMENT: 2,
      FROZEN: 1,
    });
  });

  it('valores reais só em SETTLED; fora dele são null, não zero', () => {
    for (const o of orders) {
      for (const sku of o.skus) {
        const settled = o.status === 'SETTLED';
        expect(sku.commissionSettled !== null).toBe(settled);
        expect(sku.commissionBaseActual !== null).toBe(settled);
      }
    }
  });

  it('taxas em centésimos de %, e as partes somam a total', () => {
    for (const sku of skus) {
      const { standard, shopAds, bonus, reward } = sku.rates;
      expect(standard + shopAds + bonus + reward).toBe(sku.commissionRate);
      expect(Number.isInteger(sku.commissionRate)).toBe(true);
    }
  });

  it('vendas por anúncio da loja', () => {
    const ads = skus.filter(isShopAdsSale);
    expect(ads).toHaveLength(15);
    expect(sumMoney(ads.map((x) => x.gmv))).toBe('1843.40');
  });

  it('vídeo sem TikTok Shop conectado: métricas de venda nulas', () => {
    const v = adaptVideo(rawVideos[0], null);
    expect([v.gmv, v.commission, v.gpm]).toEqual([null, null, null]);
    expect(v.views).toBeGreaterThan(0);
  });

  it('GMV por vídeo somado bate com o GMV de canal VIDEO', () => {
    const porVideo = rawVideos.map((v) => adaptVideo(v, orders).gmv ?? '0.00');
    const canalVideo = s.byChannel.find((c) => c.channel === 'VIDEO')?.gmv;
    expect(sumMoney(porVideo)).toBe(canalVideo);
  });

  it('detalhe de produto soma o mesmo que a linha', () => {
    const top = s.topProducts[0];
    const d = productDetail(top.productId, orders, rawVideos.map((v) => adaptVideo(v, orders)));
    expect(d?.gmv).toBe(top.gmv);
    expect(d?.units).toBe(top.units);
  });
});
