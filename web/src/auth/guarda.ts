import { useEffect } from 'react';
import { redirect, useNavigate, type LoaderFunction, type LoaderFunctionArgs } from 'react-router';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { useSession } from '@/api/queries';
import type { Sessao } from '@/api/schemas';
import { sessionQuery } from '@/api/session';

/**
 * Guarda de rota. Quem decide se a sessão vale é o backend: o cookie é `httpOnly`, o front
 * não o lê, e a única resposta que conta é a de `GET /auth/session`. Nada de booleano de
 * sessão no cliente, nada em `localStorage`.
 *
 * Roda como `loader` do React Router 7, isto é **antes** da renderização, e não dentro de um
 * componente de layout. Um fabricante só, usado nos dois sentidos (`privada: true` exige
 * sessão; `privada: false` expulsa quem já entrou), para não existir uma segunda versão.
 *
 * O 401 que chega aqui já é definitivo: `src/api/client.ts` tenta `POST /auth/refresh` uma
 * vez antes de desistir. Logo `anonimo` significa "nem o refresh vale", e não "o access
 * token de 15 minutos venceu" — a guarda não precisa saber a diferença, e não deve.
 */

export const ROTA_LOGADO = '/inicio';
export const ROTA_ENTRAR = '/entrar';
/** Para onde voltar depois de entrar. Vai na URL porque `redirect()` não carrega estado. */
export const PARAM_DESTINO = 'proxima';

export type EstadoSessao =
  | { tipo: 'logado'; sessao: Sessao }
  | { tipo: 'anonimo' }
  | { tipo: 'indisponivel'; erro: unknown };

export async function lerSessao(queryClient: QueryClient): Promise<EstadoSessao> {
  try {
    // `fetchQuery`, e não `ensureQueryData`: o guarda não pode decidir a partir de cache
    // já marcado como velho. Dentro do `staleTime` reusa o que o loader anterior buscou
    // (uma requisição por navegação, não duas); fora dele, pergunta ao backend de novo.
    // Com `ensureQueryData`, sair da conta deixaria a sessão antiga valendo no cache.
    return { tipo: 'logado', sessao: await queryClient.fetchQuery(sessionQuery) };
  } catch (erro) {
    if (erro instanceof ApiError && erro.code === 'nao_autenticado') return { tipo: 'anonimo' };
    // Rede caída, 500 ou resposta fora do contrato não é "não autenticado": mandar para
    // /entrar aqui esconderia a falha e pediria à pessoa uma senha que ela já deu.
    return { tipo: 'indisponivel', erro };
  }
}

/** Só caminho interno. `//host` e `http://host` viram `null`: redirect aberto é furo. */
export function destinoInterno(valor: string | null): string | null {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//')) return null;
  return valor;
}

export interface OpcoesGuarda {
  /** `true` exige sessão; `false` é rota de entrada, que manda quem já entrou para o app. */
  privada: boolean;
}

export function guarda(queryClient: QueryClient, { privada }: OpcoesGuarda): LoaderFunction {
  return async ({ request }: LoaderFunctionArgs): Promise<EstadoSessao> => {
    const estado = await lerSessao(queryClient);

    if (privada && estado.tipo === 'anonimo') {
      const { pathname, search } = new URL(request.url);
      const destino = `${pathname}${search}`;
      const volta =
        destino === ROTA_LOGADO ? '' : `?${PARAM_DESTINO}=${encodeURIComponent(destino)}`;
      throw redirect(`${ROTA_ENTRAR}${volta}`);
    }
    if (!privada && estado.tipo === 'logado') throw redirect(ROTA_LOGADO);

    return estado;
  };
}

/**
 * Rede de segurança dentro do render. O loader decide antes de a tela montar, mas o access
 * token dura 15 minutos: a sessão vence com a aba aberta, sem nenhuma navegação pelo meio.
 * Um lugar só — o AppLayout e o Início rápido usam este, não cada um o seu.
 */
export function useSessaoViva(): ReturnType<typeof useSession> {
  const sessao = useSession();
  const navigate = useNavigate();
  const venceu = sessao.error instanceof ApiError && sessao.error.code === 'nao_autenticado';

  useEffect(() => {
    if (venceu) navigate(ROTA_ENTRAR, { replace: true });
  }, [venceu, navigate]);

  return sessao;
}
