import { Skeleton } from '@/components/ui/skeleton';

/**
 * Primeira pintura, antes de qualquer tela: os loaders de rota ainda estão lendo a sessão
 * no backend. É o `HydrateFallback` da raiz — sem ele a página fica branca nesse intervalo.
 */
export function CarregandoApp() {
  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-fundo p-6" aria-busy="true">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
