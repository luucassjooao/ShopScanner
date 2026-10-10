import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useNotifications, useOrders, usePlans, useSummary } from '@/api/queries';
import { derivarAvisos } from '@/lib/avisos';
import { hojeSP, intervaloDoPreset, periodo, somarDias, useConta } from './filtros';

/**
 * Quais avisos já foram vistos. É conveniência de quem está no aparelho, não dado da conta:
 * fica no `localStorage` e, se ele falhar (aba privada), tudo aparece como não lido.
 */
const CHAVE = 'shopscanner:avisos-lidos';
const ouvintes = new Set<() => void>();

function lerLidos(): string {
  try {
    return localStorage.getItem(CHAVE) ?? '[]';
  } catch {
    return '[]';
  }
}

function gravarLidos(ids: string[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ids));
  } catch {
    // sem armazenamento: segue sem lembrar
  }
  ouvintes.forEach((f) => f());
}

export function useAvisos() {
  const conta = useConta();
  const id = conta?.hasSales ? conta.id : '';
  const hoje = hojeSP();
  const mes = intervaloDoPreset('mes', hoje);
  const semana = { de: somarDias(hoje, -6), ate: hoje };
  const semanaAntes = { de: somarDias(hoje, -13), ate: somarDias(hoje, -7) };

  const settings = useNotifications();
  const pedidos = useOrders(periodo(id, semana.de, semana.ate), { pageSize: 100 });
  const resumoMes = useSummary(periodo(id, mes.de, mes.ate));
  const resumoSemana = useSummary(periodo(id, semana.de, semana.ate));
  const resumoAntes = useSummary(periodo(id, semanaAntes.de, semanaAntes.ate));
  const planos = usePlans();

  const lidosTexto = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    lerLidos,
    () => '[]',
  );

  const avisos = useMemo(() => {
    // Sem as preferências, ou com o canal do app desligado, o sino fica quieto.
    if (!settings.data?.channels.inApp) return [];
    return derivarAvisos({
      settings: settings.data,
      pedidosRecentes: pedidos.data?.items ?? [],
      resumoMes: resumoMes.data,
      gmvSemana: resumoSemana.data?.gmv,
      gmvSemanaAnterior: resumoAntes.data?.gmv,
      planos: planos.data ?? [],
      mes: hoje.slice(0, 7),
    });
  }, [
    settings.data,
    pedidos.data,
    resumoMes.data,
    resumoSemana.data,
    resumoAntes.data,
    planos.data,
    hoje,
  ]);

  const lidos = useMemo(() => {
    try {
      return new Set(JSON.parse(lidosTexto) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [lidosTexto]);

  const marcarTodosComoLidos = useCallback(
    () => gravarLidos([...new Set([...lidos, ...avisos.map((a) => a.id)])]),
    [avisos, lidos],
  );

  return {
    avisos,
    pedidos: pedidos.data?.items ?? [],
    naoLidos: avisos.filter((a) => !lidos.has(a.id)).length,
    lidos,
    marcarTodosComoLidos,
    isPending: settings.isPending,
  };
}
