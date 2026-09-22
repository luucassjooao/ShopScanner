import { describe, expect, it } from 'vitest';
import { divRound, fromCents, sumMoney, toCents } from './money';

describe('money', () => {
  it('converte texto decimal em centavos e volta sem perder nada', () => {
    expect(toCents('11378.50')).toBe(1137850n);
    expect(toCents('0.1')).toBe(10n);
    expect(toCents('-2.05')).toBe(-205n);
    expect(fromCents(5n)).toBe('0.05');
    expect(fromCents(-205n)).toBe('-2.05');
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30'); // 0.1 + 0.2 em float dá 0.30000000000000004
  });

  it('recusa mais de duas casas em vez de arredondar calado', () => {
    expect(() => toCents('1.005')).toThrow(TypeError);
    expect(() => toCents('1,50')).toThrow(TypeError);
  });

  it('divide arredondando meio para cima', () => {
    expect(divRound(1137850n, 80n)).toBe(14223n); // 142,23125
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(-5n, 2n)).toBe(-3n);
  });
});
