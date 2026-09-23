import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { ApiError } from '@/api/client';
import type { OrderStatus } from '@/api/schemas';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATUS_LABEL } from '@/lib/labels';

/** Peças compartilhadas pelas telas de dados (vendas, produtos, vídeos). */

const STATUS_VARIANT: Record<OrderStatus, NonNullable<BadgeProps['variant']>> = {
  AWAITING_PAYMENT: 'aguardando',
  TO_SETTLE: 'a-liquidar',
  SETTLED: 'liquidado',
  REFUNDED: 'reembolsado',
  FROZEN: 'retido',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Métrica de venda nula: "ainda não disponível", nunca zero (CLAUDE.md). */
export function Indisponivel() {
  return (
    <span className="text-legenda text-texto-secundario">
      Disponível quando você conectar o TikTok Shop
    </span>
  );
}

export function CabecalhoPagina({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-titulo text-texto">{titulo}</h1>
      <p className="text-corpo-sm text-texto-secundario">{descricao}</p>
    </header>
  );
}

/** Uma linha de filtros acima do conteúdo; quebra no celular. */
export function LinhaFiltros({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

export function FiltroPeriodo({
  de,
  ate,
  onChange,
}: {
  de: string;
  ate: string;
  onChange: (m: { de?: string; ate?: string }) => void;
}) {
  const campo =
    'h-12 rounded-campo border border-borda bg-superficie px-3 text-corpo-sm font-semibold text-texto';
  return (
    <>
      <label className="flex flex-col gap-1 text-legenda font-semibold text-texto-secundario">
        De
        <input
          type="date"
          className={campo}
          value={de}
          max={ate}
          onChange={(e) => e.target.value && onChange({ de: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-legenda font-semibold text-texto-secundario">
        Até
        <input
          type="date"
          className={campo}
          value={ate}
          min={de}
          onChange={(e) => e.target.value && onChange({ ate: e.target.value })}
        />
      </label>
    </>
  );
}

const TODOS = 'todos';

/** Select com a opção "Todos"; o Radix não aceita valor vazio, então "todos" vira `null`. */
export function FiltroSelect({
  rotulo,
  valor,
  opcoes,
  onChange,
  semTodos = false,
}: {
  rotulo: string;
  valor: string | null;
  opcoes: { valor: string; rotulo: string }[];
  onChange: (v: string | null) => void;
  semTodos?: boolean;
}) {
  return (
    <div className="flex min-w-44 flex-col gap-1">
      <span className="text-legenda font-semibold text-texto-secundario">{rotulo}</span>
      <Select value={valor ?? TODOS} onValueChange={(v) => onChange(v === TODOS ? null : v)}>
        <SelectTrigger aria-label={rotulo}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {semTodos ? null : <SelectItem value={TODOS}>Todos</SelectItem>}
          {opcoes.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Paginacao({
  pagina,
  total,
  pageSize,
  onChange,
}: {
  pagina: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (paginas === 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pagina <= 1}
        onClick={() => onChange(pagina - 1)}
      >
        <ChevronLeft aria-hidden /> Anterior
      </Button>
      <span className="text-corpo-sm text-texto-secundario">
        Página {pagina} de {paginas}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagina >= paginas}
        onClick={() => onChange(pagina + 1)}
      >
        Próxima <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}

/** Carregando, erro ou vazio: o que a tela mostra enquanto não há dado para mostrar. */
export function EstadoConsulta({
  isPending,
  error,
  vazio,
  mensagemVazio,
  onRetry,
}: {
  isPending: boolean;
  error: unknown;
  vazio: boolean;
  mensagemVazio: string;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <Card className="flex flex-col items-start gap-3 p-5">
        <p className="text-corpo-sm text-texto-secundario">
          {error instanceof ApiError ? error.message : 'Algo deu errado. Tente de novo.'}
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      </Card>
    );
  }
  if (vazio) {
    return (
      <Card className="p-5">
        <p className="text-corpo-sm text-texto-secundario">{mensagemVazio}</p>
      </Card>
    );
  }
  return null;
}

/** Estado "TikTok Shop não conectado": telas que dependem de pedidos mostram isto. */
export function ShopDesconectado({ oQue }: { oQue: string }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <Store className="size-6 text-acao" aria-hidden />
      <h2 className="text-lg font-bold text-texto">Conecte o TikTok Shop para ver {oQue}</h2>
      <p className="max-w-prose text-corpo-sm text-texto-secundario">
        Os dados de vendas e comissões chegam pela conta do TikTok Shop. Enquanto ela não estiver
        conectada, você já consegue acompanhar os seus vídeos.
      </p>
    </Card>
  );
}

/** Par rótulo/valor dos painéis de detalhe. Use dentro de um `<dl>`. */
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-legenda text-texto-secundario">{rotulo}</dt>
      <dd className="text-corpo-sm font-semibold text-texto">{children}</dd>
    </div>
  );
}
