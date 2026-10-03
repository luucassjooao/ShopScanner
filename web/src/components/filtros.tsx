import { useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInteiro } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Filtros, busca, chips e paginação das listas (Vendas, Produtos, Vídeos). */

export const campoFiltro =
  'h-11 rounded-campo border border-borda bg-superficie px-3 text-sm font-semibold text-texto';

export function Busca({
  inicial,
  rotulo,
  onBuscar,
}: {
  inicial: string;
  rotulo: string;
  onBuscar: (q: string | null) => void;
}) {
  const [valor, setValor] = useState(inicial);
  function enviar(e: FormEvent) {
    e.preventDefault();
    onBuscar(valor.trim() || null);
  }
  return (
    <form role="search" onSubmit={enviar} className="relative min-w-52 flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-secundario"
        aria-hidden
      />
      <input
        type="search"
        aria-label={rotulo}
        placeholder={rotulo}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => valor.trim() !== inicial && onBuscar(valor.trim() || null)}
        className="h-11 w-full rounded-campo border border-borda bg-superficie pl-9 pr-3 text-sm text-texto placeholder:text-texto-secundario/80"
      />
    </form>
  );
}

export function ChipsFiltro({
  chips,
  onLimpar,
}: {
  chips: { rotulo: string; nome: string; remover?: () => void }[];
  onLimpar?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-semibold text-texto-secundario">Filtros ativos</span>
      {chips.map((c) => (
        <span
          key={c.nome}
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-full bg-pessego pl-3 text-[13px] font-semibold text-texto',
            c.remover ? 'pr-1' : 'pr-3',
          )}
        >
          {c.rotulo}
          {c.remover ? (
            <button
              type="button"
              aria-label={`Remover filtro de ${c.nome}`}
              onClick={c.remover}
              className="inline-flex size-7 items-center justify-center rounded-full hover:bg-coral"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
      {onLimpar ? (
        <button
          type="button"
          onClick={onLimpar}
          className="text-[13px] font-semibold text-acao hover:underline"
        >
          Limpar tudo
        </button>
      ) : null}
    </div>
  );
}

export function Carregando({ rotulo }: { rotulo: string }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-card border border-borda bg-superficie p-4"
      aria-busy="true"
    >
      <span className="text-sm font-semibold text-texto-secundario">{rotulo}</span>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function Rodape({
  itens,
  total,
  unidade = 'pedidos',
  pagina,
  pageSize,
  onPagina,
}: {
  itens: number;
  total: number;
  unidade?: string;
  pagina: number;
  pageSize: number;
  onPagina: (n: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-texto-secundario">
        Mostrando {formatInteiro(itens)} {unidade === 'pedidos' ? 'itens de ' : 'de '}
        {formatInteiro(total)} {unidade}
      </span>
      {paginas > 1 ? (
        <nav aria-label="Paginação" className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina <= 1}
            onClick={() => onPagina(pagina - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-texto-secundario">
            Página {pagina} de {paginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= paginas}
            onClick={() => onPagina(pagina + 1)}
          >
            Próxima
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
