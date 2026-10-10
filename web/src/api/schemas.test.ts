import { describe, expect, it } from 'vitest';
import { conta, perfilInput, registerInput, usuario } from './schemas';
import { env } from '@/env';

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

describe('avatarUrl tem duas procedências', () => {
  const user = {
    id: 'u_1',
    name: 'Ana Lima',
    email: 'ana@email.com.br',
    emailVerified: true,
    hasPassword: true,
    identities: [],
    acceptedTermsVersion: '2026-09-22',
  };

  it('no usuário, o upload relativo vira absoluto na API; ausência fica null', () => {
    expect(usuario.parse({ ...user, avatarUrl: '/me/avatar?v=3f9a' }).avatarUrl).toBe(
      `${env.apiUrl}/me/avatar?v=3f9a`,
    );
    expect(usuario.parse({ ...user, avatarUrl: null }).avatarUrl).toBeNull();
  });

  it('na conta, a foto do TikTok passa intacta', () => {
    const foto = 'https://p16-sign.tiktokcdn.com/aweme/avatar.jpeg';
    const parsed = conta.parse({
      id: 'acc_1',
      username: '@creator',
      avatarUrl: foto,
      shopConnected: false,
      hasSales: true,
      connectedAt: '2026-08-02T12:00:00.000Z',
      lastSyncedAt: null,
      expiresAt: null,
    });
    expect(parsed.avatarUrl).toBe(foto);
  });
});
