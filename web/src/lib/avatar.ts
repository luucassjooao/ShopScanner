import { LIMITE_AVATAR_MB } from './textos';

/** Formatos que a API aceita, pelos bytes. A extensão aqui é só conveniência. */
const EXTENSOES = /\.(jpe?g|png|webp)$/i;

/**
 * Recusa que dá para ver antes de enviar, com os mesmos códigos da API. Só antecipa: a
 * API confere de novo pelos bytes, e a palavra final é dela. Extensão certa com conteúdo
 * errado passa daqui e cai na API, que responde `IMAGEM_INVALIDA`.
 */
export function recusaLocalAvatar(arquivo: File): 'IMAGEM_MUITO_GRANDE' | 'IMAGEM_INVALIDA' | null {
  if (arquivo.size > LIMITE_AVATAR_MB * 1024 * 1024) return 'IMAGEM_MUITO_GRANDE';
  if (!EXTENSOES.test(arquivo.name)) return 'IMAGEM_INVALIDA';
  return null;
}
