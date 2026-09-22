import type { Money } from '@/api/schemas';

/**
 * Aritmética de dinheiro em centavos inteiros (`bigint`), nunca em float.
 * Dinheiro do contrato tem no máximo 2 casas; mais que isso é recusado para não arredondar calado.
 */

const MONEY_RE = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

export function toCents(value: Money): bigint {
  const m = MONEY_RE.exec(value);
  if (!m) throw new TypeError(`Dinheiro inválido: ${JSON.stringify(value)}`);
  const cents = BigInt(m[2]) * 100n + BigInt((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -cents : cents;
}

export function fromCents(cents: bigint): Money {
  const sinal = cents < 0n ? '-' : '';
  const abs = (cents < 0n ? -cents : cents).toString().padStart(3, '0');
  return `${sinal}${abs.slice(0, -2)}.${abs.slice(-2)}`;
}

export function sumMoney(values: Iterable<Money>): Money {
  let total = 0n;
  for (const v of values) total += toCents(v);
  return fromCents(total);
}

/** Divisão inteira com arredondamento meio para cima (longe do zero). */
export function divRound(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new RangeError('divisão por zero');
  const neg = n < 0n !== d < 0n;
  const [a, b] = [n < 0n ? -n : n, d < 0n ? -d : d];
  const q = (a * 2n + b) / (b * 2n);
  return neg ? -q : q;
}
