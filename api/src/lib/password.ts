import { argon2id, hash, verify, type HashOptions } from 'argon2';
import { env } from '../config/env.ts';

// Em teste o custo cai: são dezenas de hashes por execução e o que se quer
// provar ali é o fluxo, não a dureza do KDF.
const opcoes: HashOptions =
  env.NODE_ENV === 'test'
    ? { type: argon2id, memoryCost: 4096, timeCost: 1, parallelism: 1 }
    : { type: argon2id };

let hashDescartavel: Promise<string> | null = null;

export function hashSenha(senha: string): Promise<string> {
  return hash(senha, opcoes);
}

/**
 * Conferência em tempo constante. Sem usuário, ou com usuário sem senha, ainda
 * assim gasta um argon2: é o que faz "e-mail não existe" e "senha errada"
 * levarem o mesmo tempo, além da mesma mensagem.
 */
export async function conferirSenha(digest: string | null, senha: string): Promise<boolean> {
  if (!digest) {
    const descartavel = (hashDescartavel ??= hash('senha-que-nao-existe', opcoes));
    await verify(await descartavel, senha).catch(() => false);
    return false;
  }
  return verify(digest, senha).catch(() => false);
}
