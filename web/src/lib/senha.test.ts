import { describe, expect, it } from 'vitest';
import { forcaDaSenha, ROTULO_FORCA } from './senha';

describe('forcaDaSenha', () => {
  it('um ponto por critério', () => {
    expect(ROTULO_FORCA[forcaDaSenha('abc')]).toBe('Muito fraca');
    expect(ROTULO_FORCA[forcaDaSenha('abcdefgh')]).toBe('Fraca');
    expect(ROTULO_FORCA[forcaDaSenha('Abcdefgh')]).toBe('Média');
    expect(ROTULO_FORCA[forcaDaSenha('Abcdefg1')]).toBe('Boa');
    expect(ROTULO_FORCA[forcaDaSenha('Abcdef1!')]).toBe('Forte');
  });
});
