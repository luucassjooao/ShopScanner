import { describe, expect, it } from 'vitest';
import { importErroCodigo } from '@/api/schemas';
import { emAndamento, LIMITE_MB, orientacaoDoErro, recusaLocal, resumoDoResultado } from './import';

describe('resumoDoResultado', () => {
  it('fala no plural certo e esconde o que não houve', () => {
    expect(resumoDoResultado({ created: 12, updated: 3, unchanged: 65, skipped: 0 })).toBe(
      '12 novas, 3 atualizadas, 65 sem mudança',
    );
    expect(resumoDoResultado({ created: 1, updated: 1, unchanged: 0, skipped: 1 })).toBe(
      '1 nova, 1 atualizada, 0 sem mudança, 1 ignorada',
    );
  });
});

describe('orientacaoDoErro', () => {
  it('todo código do contrato tem título e saída, sem texto genérico', () => {
    for (const codigo of importErroCodigo.options) {
      const { titulo, comoResolver } = orientacaoDoErro(codigo);
      expect(titulo.length).toBeGreaterThan(10);
      expect(comoResolver.length).toBeGreaterThan(20);
    }
  });
});

describe('emAndamento', () => {
  it('só a fila e o processamento seguem sendo consultados', () => {
    expect(emAndamento({ status: 'QUEUED' })).toBe(true);
    expect(emAndamento({ status: 'PROCESSING' })).toBe(true);
    expect(emAndamento({ status: 'DONE' })).toBe(false);
    expect(emAndamento({ status: 'FAILED' })).toBe(false);
  });
});

describe('recusaLocal', () => {
  const arquivo = (nome: string, mb: number) => ({ name: nome, size: mb * 1024 * 1024 }) as File;

  it('barra o que a especificação já descarta, antes de gastar o envio', () => {
    expect(recusaLocal(arquivo('relatorio.csv', 1))).toBe('WRONG_EXTENSION');
    expect(recusaLocal(arquivo('relatorio.xlsx', LIMITE_MB + 1))).toBe('TOO_LARGE');
  });

  it('deixa passar o que só o servidor sabe julgar', () => {
    expect(recusaLocal(arquivo('affiliate_orders.xlsx', 2))).toBeNull();
    // Maiúsculas na extensão e o limite exato continuam valendo.
    expect(recusaLocal(arquivo('AFFILIATE_ORDERS.XLSX', LIMITE_MB))).toBeNull();
  });
});
