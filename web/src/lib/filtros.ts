import { useSearchParams } from 'react-router';
import { useSession, type Periodo } from '@/api/queries';
import type { Conta } from '@/api/schemas';
import { dayKey } from './metrics';

/** `2026-09-22` + n dias, em data de calendário (sem fuso). */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dias entre `de` e `ate`, contando os dois. */
export const diasNoIntervalo = (de: string, ate: string): number =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000) + 1;

// São Paulo está em UTC−3 fixo desde 2019 (sem horário de verão).
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`).toISOString();
const fimDoDia = (dia: string) => new Date(`${dia}T23:59:59.999-03:00`).toISOString();
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export const hojeSP = (): string => dayKey(new Date().toISOString());

export type Preset = '7' | '30' | 'mes' | 'personalizado';

/** Intervalo de dias de São Paulo (`AAAA-MM-DD`), do jeito que ele mora na URL. */
export type Intervalo = {
  de: string;
  ate: string;
};

export function intervaloDoPreset(
  preset: Exclude<Preset, 'personalizado'>,
  hoje = hojeSP(),
): Intervalo {
  if (preset === 'mes') return { de: `${hoje.slice(0, 8)}01`, ate: hoje };
  return { de: somarDias(hoje, -(Number(preset) - 1)), ate: hoje };
}

/** `22/09/2026` a partir de `2026-09-22`. */
export const diaBR = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
/** `22/09` a partir de `2026-09-22`. */
export const diaMesBR = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** O que `useFiltros` entrega. É o tipo que quase toda tela de dados consome. */
export interface Filtros extends Intervalo {
  /** Qualquer parâmetro da URL, cru. */
  get: (chave: string) => string | null;
  /** `null` ou `''` remove a chave. Mudar qualquer filtro volta para a página 1. */
  set: (mudancas: Record<string, string | null>) => void;
  pagina: number;
  preset: Preset;
  rotuloPeriodo: string;
}

/**
 * Filtros moram na URL (`?de=2026-08-24&ate=2026-09-22&status=...&pagina=2`):
 * dá para compartilhar o link e voltar com o botão do navegador.
 */
export function useFiltros(): Filtros {
  const [params, setParams] = useSearchParams();

  /** `null` ou `''` remove a chave. Mudar qualquer filtro volta para a página 1. */
  function set(mudancas: Record<string, string | null>) {
    setParams((atual) => {
      const nova = new URLSearchParams(atual);
      for (const [k, v] of Object.entries(mudancas)) {
        if (v) nova.set(k, v);
        else nova.delete(k);
      }
      if (!('pagina' in mudancas)) nova.delete('pagina');
      return nova;
    });
  }

  const hoje = hojeSP();
  const deUrl = params.get('de');
  const ateUrl = params.get('ate');
  const padrao = intervaloDoPreset('30', hoje);
  const ate = ateUrl && DIA_RE.test(ateUrl) ? ateUrl : padrao.ate;
  const de = deUrl && DIA_RE.test(deUrl) ? deUrl : ateUrl ? somarDias(ate, -29) : padrao.de;
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  const preset: Preset =
    (['7', '30', 'mes'] as const).find((p) => {
      const i = intervaloDoPreset(p, hoje);
      return i.de === de && i.ate === ate;
    }) ?? 'personalizado';

  const rotuloPeriodo =
    preset === '7'
      ? 'Últimos 7 dias'
      : preset === '30'
        ? 'Últimos 30 dias'
        : preset === 'mes'
          ? 'Este mês'
          : `${diaBR(de)} a ${diaBR(ate)}`;

  return { get: (k: string) => params.get(k), set, de, ate, pagina, preset, rotuloPeriodo };
}

/** A conta ativa: a escolhida no seletor do topo (`?conta=`), senão a primeira da sessão. */
export function useConta(): Conta | undefined {
  const [params] = useSearchParams();
  // A sessão já está no cache: o loader da rota a carregou antes de qualquer tela montar.
  const contas = useSession().data?.accounts ?? [];
  return contas.find((c) => c.id === params.get('conta')) ?? contas[0];
}

export function periodo(accountId: string, de: string, ate: string): Periodo {
  return { accountId, from: inicioDoDia(de), to: fimDoDia(ate) };
}

/** Período de mesmo tamanho imediatamente antes de `de`, para comparação. */
export function periodoAnterior(de: string, ate: string): Intervalo {
  const n = diasNoIntervalo(de, ate);
  return { de: somarDias(de, -n), ate: somarDias(de, -1) };
}

/** Conexão do TikTok vencida: é preciso reconectar para voltar a ler. */
export const conexaoExpirada = (c: Conta | undefined): boolean =>
  !!c?.expiresAt && Date.parse(c.expiresAt) < Date.now();
