import type { PlanStatus } from '@/api/schemas';
import { dayKey } from './metrics';

/**
 * Regras da pauta (CLAUDE.md): o `title` é obrigatório no contrato, mas o formulário não pede.
 * Ele sai das primeiras palavras do gancho; gancho vazio vira "Pauta sem nome".
 */
export const SEM_NOME = 'Pauta sem nome';

export function nomeDoGancho(gancho: string, palavras = 7): string {
  const limpo = gancho.replace(/\s+/g, ' ').trim();
  if (!limpo) return SEM_NOME;
  const corte = limpo.split(' ');
  const nome = corte
    .slice(0, palavras)
    .join(' ')
    .replace(/[.,;:!?…]+$/, '');
  return corte.length > palavras ? `${nome}…` : nome;
}

/** O que falta fazer em cada etapa, para o calendário ("Gravar · 10:00"). */
export const ACAO_DA_ETAPA: Record<PlanStatus, string> = {
  IDEA: 'Roteiro',
  SCRIPT: 'Gravar',
  RECORDED: 'Editar',
  EDITED: 'Postar',
  POSTED: 'Postado',
};

// São Paulo em UTC−3 fixo desde 2019.
const hora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Data e horário da pauta no fuso de São Paulo. O contrato guarda ISO; sem horário escolhido,
 * guardamos meia-noite.
 * ponytail: meia-noite significa "sem horário"; vira campo próprio se alguém postar à meia-noite.
 */
export function paraCampos(iso: string | null): { data: string; hora: string } {
  if (!iso) return { data: '', hora: '' };
  const h = hora.format(new Date(iso));
  return { data: dayKey(iso), hora: h === '00:00' ? '' : h };
}

export function deCampos(data: string, horario: string): string | null {
  if (!data) return null;
  return new Date(`${data}T${horario || '00:00'}:00-03:00`).toISOString();
}

/** `"19:00"`, ou `"—"` quando a pauta não tem horário. */
export const horaDaPauta = (iso: string) => paraCampos(iso).hora || '—';
