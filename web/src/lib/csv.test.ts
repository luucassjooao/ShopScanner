import { describe, expect, it } from 'vitest';
import { orders } from '@/mocks/adapters/tiktok';
import { productRows } from './metrics';
import { percentual, produtosCsv, vendasCsv } from './csv';

describe('vendasCsv', () => {
  const csv = vendasCsv(orders);
  const linhas = csv.split('\r\n');

  it('uma linha por item, com cabeçalho e BOM para o Excel', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(linhas).toHaveLength(1 + 90);
    expect(linhas[0]).toContain('Data;Pedido;Produto');
  });

  it('dinheiro com vírgula decimal e comissão real só em liquidado', () => {
    const liquidado = linhas.find((l) => l.includes(';Liquidado;'))!;
    expect(liquidado).toMatch(/;\d+,\d{2};\d+,\d{2};sim;/);
    const aLiquidar = linhas.find((l) => l.includes(';A liquidar;'))!;
    expect(aLiquidar).toContain(';não (estimada);');
  });
});

describe('produtosCsv e percentual', () => {
  it('reembolso em % com uma casa, sem dividir por zero', () => {
    expect(percentual(1, 15)).toBe('6,7%');
    expect(percentual(0, 0)).toBe('0,0%');
  });

  it('uma linha por produto', () => {
    const csv = produtosCsv(productRows(orders));
    expect(csv.split('\r\n')).toHaveLength(1 + 10);
  });
});
