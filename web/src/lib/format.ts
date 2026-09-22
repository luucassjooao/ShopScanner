/**
 * Formatadores em pt-BR, fuso America/Sao_Paulo.
 *
 * Dinheiro chega do backend como **texto decimal** (`"11378.50"`), nunca como número.
 * Aqui ele continua texto até o fim: `Intl.NumberFormat#format` aceita string desde o
 * Intl.NumberFormat V3 e formata o decimal com precisão exata. Converter para `number`
 * em qualquer ponto reintroduz erro de ponto flutuante — por isso não fazemos isso.
 */

const LOCALE = 'pt-BR';
const TZ = 'America/Sao_Paulo';

/** `Intl.NumberFormat#format` aceita string (Intl.NumberFormat V3); os tipos nem sempre. */
type DecimalFormatter = { format(value: string): string };

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export class DecimalInvalidoError extends TypeError {
  constructor(value: string) {
    super(`Valor decimal inválido: ${JSON.stringify(value)}`);
    this.name = 'DecimalInvalidoError';
  }
}

/** Garante que o texto é um decimal simples antes de formatar. */
export function assertDecimal(value: string): string {
  if (typeof value !== 'string' || !DECIMAL_RE.test(value)) {
    throw new DecimalInvalidoError(value as string);
  }
  return value;
}

const brl = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}) as unknown as DecimalFormatter;

/** `"11378.50"` → `"R$ 11.378,50"`. Aceita só texto decimal. */
export function formatMoeda(value: string): string {
  return brl.format(assertDecimal(value));
}

const decimal2 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}) as unknown as DecimalFormatter;

/** `"11378.50"` → `"11.378,50"`, sem o símbolo da moeda. */
export function formatDecimal(value: string): string {
  return decimal2.format(assertDecimal(value));
}

const inteiro = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** `191833` → `"191.833"`. Para contagens (views, itens, pedidos). */
export function formatInteiro(value: number): string {
  return inteiro.format(value);
}

/**
 * Taxas chegam como **inteiro em centésimos de %** (`1500` = 15%), igual ao TikTok.
 * A divisão é feita em texto, não em float: `1033` vira `"0.1033"`, não `1033 / 10000`.
 */
export function taxaParaFracao(centesimosDePorcento: number): string {
  if (!Number.isInteger(centesimosDePorcento)) {
    throw new TypeError(`Taxa precisa ser inteiro em centésimos de %: ${centesimosDePorcento}`);
  }
  const sinal = centesimosDePorcento < 0 ? '-' : '';
  const digitos = Math.abs(centesimosDePorcento).toString().padStart(5, '0');
  return `${sinal}${digitos.slice(0, -4)}.${digitos.slice(-4)}`;
}

/** `1500` → `"15%"`, `1033` → `"10,33%"`. Entrada em centésimos de %. */
export function formatTaxa(
  centesimosDePorcento: number,
  { casas = 2 }: { casas?: number } = {},
): string {
  const fmt = new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  }) as unknown as DecimalFormatter;
  return fmt.format(taxaParaFracao(centesimosDePorcento));
}

function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Data inválida: ${String(value)}`);
  }
  return date;
}

const data = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** ISO 8601 UTC → `"22/09/2026"` no fuso de São Paulo. */
export function formatData(value: string | Date): string {
  return data.format(toDate(value));
}

const dataHora = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** ISO 8601 UTC → `"22/09/2026, 20:30"` no fuso de São Paulo. */
export function formatDataHora(value: string | Date): string {
  return dataHora.format(toDate(value));
}

const hora = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** ISO 8601 UTC → `"20:30"` no fuso de São Paulo. */
export function formatHora(value: string | Date): string {
  return hora.format(toDate(value));
}

const diaMes = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: '2-digit', month: '2-digit' });

/** ISO 8601 UTC → `"22/09"`. Para eixo de gráfico e listas compactas. */
export function formatDiaMes(value: string | Date): string {
  return diaMes.format(toDate(value));
}
