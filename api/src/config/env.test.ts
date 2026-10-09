import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AMBIENTE_DE_TESTE } from '../test/env.ts';

/**
 * O env.ts derruba o processo quando falha, então o teste sobe um filho com o
 * ambiente de teste e troca só o que interessa.
 */
const ENV_TS = fileURLToPath(new URL('./env.ts', import.meta.url));

function subir(trocas: Record<string, string>) {
  try {
    execFileSync(process.execPath, [ENV_TS], {
      env: { ...AMBIENTE_DE_TESTE, ...trocas },
      stdio: 'pipe',
    });
    return { codigo: 0, saida: '' };
  } catch (erro) {
    const e = erro as { status: number; stderr: Buffer };
    return { codigo: e.status, saida: e.stderr.toString() };
  }
}

describe('config do ambiente', () => {
  it('sobe com as opcionais vazias: vazio vale como ausente', () => {
    const { codigo } = subir({
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_REDIRECT_URI: '',
      TIKTOK_CLIENT_KEY: '',
      TIKTOK_CLIENT_SECRET: '',
      TIKTOK_REDIRECT_URI: '',
      TIKTOK_SHOP_ENABLED: '',
    });
    expect(codigo).toBe(0);
  });

  it('segredo obrigatório vazio derruba o boot e nomeia a variável', () => {
    for (const nome of ['JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL']) {
      const { codigo, saida } = subir({ [nome]: '' });
      expect(codigo, nome).toBe(1);
      expect(saida, nome).toContain(nome);
    }
  });
});
