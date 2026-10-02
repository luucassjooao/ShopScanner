import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.ts';

/**
 * AES-256-GCM para os tokens de terceiros. Formato: iv(12) || tag(16) || texto.
 * A chave vem de ENCRYPTION_KEY; a linha guarda `key_version` para dar para
 * trocar a chave depois sem obrigar todo mundo a reconectar.
 */
export const VERSAO_DA_CHAVE = 1;

const chave = Buffer.from(env.ENCRYPTION_KEY, 'base64');

export function cifrar(texto: string): Buffer {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  const corpo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), corpo]);
}

export function decifrar(dados: Buffer): string {
  const decifra = createDecipheriv('aes-256-gcm', chave, dados.subarray(0, 12));
  decifra.setAuthTag(dados.subarray(12, 28));
  return Buffer.concat([decifra.update(dados.subarray(28)), decifra.final()]).toString('utf8');
}
