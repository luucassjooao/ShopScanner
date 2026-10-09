import { describe, expect, it } from 'vitest';
import { perfilInput } from './schemas';

describe('perfilInput', () => {
  it('recusa nome de 1 caractere: a API exige 2', () => {
    expect(perfilInput.safeParse({ name: 'A' }).success).toBe(false);
    expect(perfilInput.safeParse({ name: ' A ' }).success).toBe(false);
  });

  it('aceita nome de 2 caracteres', () => {
    expect(perfilInput.safeParse({ name: 'Al' }).success).toBe(true);
  });
});
