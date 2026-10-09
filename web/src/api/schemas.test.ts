import { describe, expect, it } from 'vitest';
import { perfilInput, registerInput } from './schemas';

describe('registerInput', () => {
  const base = {
    email: 'ana@email.com.br',
    password: 'Abcdef1!',
    acceptedTermsVersion: '2026-09-22',
  };

  it('recusa nome de 1 letra no cadastro: a API exige 2', () => {
    expect(registerInput.safeParse({ ...base, name: 'A' }).success).toBe(false);
  });

  it('aceita nome de 2 letras no cadastro', () => {
    expect(registerInput.safeParse({ ...base, name: 'Ana' }).success).toBe(true);
  });
});

describe('perfilInput', () => {
  it('recusa nome de 1 caractere: a API exige 2', () => {
    expect(perfilInput.safeParse({ name: 'A' }).success).toBe(false);
    expect(perfilInput.safeParse({ name: ' A ' }).success).toBe(false);
  });

  it('aceita nome de 2 caracteres', () => {
    expect(perfilInput.safeParse({ name: 'Al' }).success).toBe(true);
  });
});
