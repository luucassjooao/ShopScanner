import { describe, expect, it } from 'vitest';
import { deCampos, horaDaPauta, nomeDoGancho, paraCampos, SEM_NOME } from './planos';

describe('nomeDoGancho', () => {
  it('pega as primeiras palavras e marca o corte', () => {
    expect(nomeDoGancho('Comprei a escova mais barata que achei e testei por 30 dias.')).toBe(
      'Comprei a escova mais barata que achei…',
    );
    expect(nomeDoGancho('  Olha isso!  ')).toBe('Olha isso');
  });

  it('gancho vazio vira "Pauta sem nome"', () => {
    expect(nomeDoGancho('')).toBe(SEM_NOME);
    expect(nomeDoGancho('   \n ')).toBe(SEM_NOME);
  });
});

describe('data e horário da pauta', () => {
  it('ida e volta no fuso de São Paulo', () => {
    const iso = deCampos('2026-09-24', '19:00');
    expect(iso).toBe('2026-09-24T22:00:00.000Z');
    expect(paraCampos(iso)).toEqual({ data: '2026-09-24', hora: '19:00' });
    expect(horaDaPauta(iso!)).toBe('19:00');
  });

  it('sem horário guarda meia-noite e mostra "—"', () => {
    const iso = deCampos('2026-09-24', '')!;
    expect(paraCampos(iso)).toEqual({ data: '2026-09-24', hora: '' });
    expect(horaDaPauta(iso)).toBe('—');
    expect(deCampos('', '10:00')).toBeNull();
  });
});
