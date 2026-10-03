import { describe, expect, it } from 'vitest';
import {
  DecimalInvalidoError,
  formatData,
  formatDataHora,
  haQuanto,
  formatDecimal,
  formatDiaMes,
  formatHora,
  formatInteiro,
  formatMoeda,
  formatTaxa,
  parseMoeda,
  taxaParaFracao,
} from './format';

/** pt-BR separa o símbolo da moeda com espaço não separável (U+00A0). */
const nbsp = ' ';

describe('formatMoeda', () => {
  it('formata texto decimal em reais', () => {
    expect(formatMoeda('11378.50')).toBe(`R$${nbsp}11.378,50`);
    expect(formatMoeda('0.1')).toBe(`R$${nbsp}0,10`);
    expect(formatMoeda('0')).toBe(`R$${nbsp}0,00`);
    expect(formatMoeda('-299.80')).toBe(`-R$${nbsp}299,80`);
  });

  it('não perde precisão além do que um float aguenta', () => {
    // 9007199254740993 é Number.MAX_SAFE_INTEGER + 2: some no float, sobrevive no texto.
    expect(formatMoeda('9007199254740993.75')).toContain('9.007.199.254.740.993,75');
    expect(formatMoeda('0.145')).toBe(`R$${nbsp}0,15`);
  });

  it('recusa valor que não é texto decimal', () => {
    expect(() => formatMoeda('1.234,56')).toThrow(DecimalInvalidoError);
    expect(() => formatMoeda('R$ 10')).toThrow(DecimalInvalidoError);
    expect(() => formatMoeda(11378.5 as unknown as string)).toThrow(DecimalInvalidoError);
  });
});

describe('formatDecimal e formatInteiro', () => {
  it('formata sem símbolo de moeda', () => {
    expect(formatDecimal('11378.5')).toBe('11.378,50');
  });

  it('formata contagens', () => {
    expect(formatInteiro(191833)).toBe('191.833');
    expect(formatInteiro(0)).toBe('0');
  });
});

describe('formatTaxa', () => {
  it('lê centésimos de % como o TikTok entrega', () => {
    expect(formatTaxa(1500)).toBe('15%');
    expect(formatTaxa(1033)).toBe('10,33%');
    expect(formatTaxa(0)).toBe('0%');
    expect(formatTaxa(80)).toBe('0,8%');
    expect(formatTaxa(1033, { casas: 1 })).toBe('10,3%');
  });

  it('converte a taxa em texto, sem passar por float', () => {
    expect(taxaParaFracao(1500)).toBe('0.1500');
    expect(taxaParaFracao(1033)).toBe('0.1033');
    expect(taxaParaFracao(7)).toBe('0.0007');
    expect(taxaParaFracao(150000)).toBe('15.0000');
    expect(taxaParaFracao(-250)).toBe('-0.0250');
  });

  it('recusa taxa fracionária', () => {
    expect(() => formatTaxa(10.3)).toThrow(TypeError);
  });
});

describe('datas em America/Sao_Paulo', () => {
  it('formata ISO UTC no fuso de São Paulo', () => {
    expect(formatData('2026-09-22T23:30:00Z')).toBe('22/09/2026');
    expect(formatDataHora('2026-09-22T23:30:00Z')).toBe('22/09/2026, 20:30');
    expect(formatHora('2026-09-22T23:30:00Z')).toBe('20:30');
    expect(formatDiaMes('2026-09-22T23:30:00Z')).toBe('22/09');
  });

  it('mantém o dia anterior quando o UTC já virou', () => {
    // 23/09 02:30 UTC ainda é 22/09 22:30 em São Paulo (UTC-3, sem horário de verão).
    expect(formatDataHora('2026-09-23T01:30:00Z')).toBe('22/09/2026, 22:30');
  });

  it('recusa data inválida', () => {
    expect(() => formatData('ontem')).toThrow(TypeError);
  });
});

describe('parseMoeda', () => {
  it('lê o que a creator digita em pt-BR', () => {
    expect(parseMoeda('1.500,00')).toBe('1500.00');
    expect(parseMoeda('R$ 15.000')).toBe('15000.00');
    expect(parseMoeda('2500,5')).toBe('2500.50');
    expect(parseMoeda('080')).toBe('80.00');
  });

  it('recusa formato ambíguo ou inválido em vez de chutar', () => {
    for (const v of ['', '1,500.00', '15.5', '1,234', 'abc', '-10']) {
      expect(parseMoeda(v)).toBeNull();
    }
  });
});

describe('haQuanto', () => {
  const agora = Date.parse('2026-10-01T12:00:00Z');
  it('fala em minutos, horas e dias', () => {
    expect(haQuanto('2026-10-01T11:55:00Z', agora)).toBe('há 5 minutos');
    expect(haQuanto('2026-10-01T10:00:00Z', agora)).toBe('há 2 horas');
    expect(haQuanto('2026-09-30T12:00:00Z', agora)).toBe('ontem');
    expect(haQuanto('2026-09-28T12:00:00Z', agora)).toBe('há 3 dias');
  });
});
