/** `1:05` a partir de 65 segundos. */
export const duracao = (s: number): string =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** As hashtags escritas na legenda, na ordem em que aparecem. */
export const hashtagsDe = (texto: string): string[] => texto.match(/#[\p{L}\p{N}_]+/gu) ?? [];
