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

  describe('produção', () => {
    const PRODUCAO = { NODE_ENV: 'production', TRUST_PROXY: '10.0.0.0/8' };

    it('sobe com segredos próprios e os proxies declarados', () => {
      expect(subir(PRODUCAO).codigo).toBe(0);
      expect(subir({ ...PRODUCAO, TRUST_PROXY: 'false' }).codigo).toBe(0);
      expect(subir({ ...PRODUCAO, TRUST_PROXY: 'uniquelocal, 203.0.113.9' }).codigo).toBe(0);
    });

    it('recusa os segredos de desenvolvimento do docker-compose e nomeia a variável', () => {
      const doCompose = {
        JWT_SECRET: 'desenvolvimento-troque-isto-com-32-chars',
        REFRESH_TOKEN_PEPPER: 'desenvolvimento-troque-isto-32-chars',
        ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      };
      for (const [nome, valor] of Object.entries(doCompose)) {
        const { codigo, saida } = subir({ ...PRODUCAO, [nome]: valor });
        expect(codigo, nome).toBe(1);
        expect(saida, nome).toContain(nome);
      }
      // Fora de produção continuam valendo: é para isso que existem.
      expect(subir(doCompose).codigo).toBe(0);
    });

    it('exige TRUST_PROXY, e vazio conta como ausente', () => {
      for (const valor of [undefined, '']) {
        const ambiente: Record<string, string> = { NODE_ENV: 'production' };
        if (valor !== undefined) ambiente.TRUST_PROXY = valor;
        const { codigo, saida } = subir(ambiente);
        expect(codigo).toBe(1);
        expect(saida).toContain('TRUST_PROXY');
      }
    });
  });

  it('TRUST_PROXY recusa true, número de saltos e lixo', () => {
    // true: o IP vira o que o cliente escrever. Número: o Fastify 5.12 trata como
    // "não confiar em nada", então aceitar viraria false em silêncio.
    for (const valor of ['true', '1', '2', 'proxy.interno', '10.0.0.0/40']) {
      const { codigo, saida } = subir({ TRUST_PROXY: valor });
      expect(codigo, valor).toBe(1);
      expect(saida, valor).toContain('TRUST_PROXY');
    }
  });

  it('segredo obrigatório vazio derruba o boot e nomeia a variável', () => {
    for (const nome of ['JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL']) {
      const { codigo, saida } = subir({ [nome]: '' });
      expect(codigo, nome).toBe(1);
      expect(saida, nome).toContain(nome);
    }
  });
});
