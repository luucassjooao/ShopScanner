import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { sessionQuery } from '@/api/session';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Casca das rotas do app: /inicio, /vendas, /videos, /produtos, /planejamento, /configuracoes.
 * Protegida pela sessão do backend (cookie httpOnly) — nenhum token no cliente.
 * Ainda vazia de propósito: barra lateral, topo e barra inferior entram depois.
 */
export function AppLayout() {
  const location = useLocation();
  const { data, isPending, error, refetch } = useQuery(sessionQuery);

  if (isPending) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 bg-fundo p-6" aria-busy="true">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    if (error instanceof ApiError && error.code === 'nao_autenticado') {
      return <Navigate to="/entrar" replace state={{ de: location.pathname }} />;
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-fundo p-6 text-center">
        <p className="max-w-md text-corpo text-texto-secundario">
          {error instanceof ApiError ? error.message : 'Algo deu errado. Tente de novo.'}
        </p>
        <Button onClick={() => void refetch()}>Tentar de novo</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <Outlet context={data} />
    </div>
  );
}
