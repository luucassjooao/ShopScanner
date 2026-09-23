import { useOutletContext, useSearchParams } from 'react-router-dom';
import type { Periodo } from '@/api/queries';
import type { Conta, Sessao } from '@/api/schemas';
import { dayKey } from '@/lib/metrics';

/** `2026-09-22` + n dias, em data de calendário (sem fuso). */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// São Paulo está em UTC−3 fixo desde 2019 (sem horário de verão).
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`).toISOString();
const fimDoDia = (dia: string) => new Date(`${dia}T23:59:59.999-03:00`).toISOString();
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtros moram na URL (`?de=2026-08-23&ate=2026-09-22&status=...&pagina=2`):
 * dá para compartilhar o link e voltar com o botão do navegador.
 */
export function useFiltros() {
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

  const hoje = dayKey(new Date().toISOString());
  const deUrl = params.get('de');
  const ateUrl = params.get('ate');
  const ate = ateUrl && DIA_RE.test(ateUrl) ? ateUrl : hoje;
  const de = deUrl && DIA_RE.test(deUrl) ? deUrl : somarDias(ate, -30);
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  return { get: (k: string) => params.get(k), set, de, ate, pagina };
}

/** A conta ativa vem da sessão que o AppLayout já carregou. */
export function useConta(): Conta | undefined {
  return useOutletContext<Sessao | undefined>()?.accounts[0];
}

export function periodo(accountId: string, de: string, ate: string): Periodo {
  return { accountId, from: inicioDoDia(de), to: fimDoDia(ate) };
}
