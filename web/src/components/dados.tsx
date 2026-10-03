import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileUp, Lock, SearchX, Store, Unplug } from 'lucide-react';
import { ApiError } from '@/api/client';
import type { OrderStatus, Source } from '@/api/schemas';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatData, formatDataHora, formatHora } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';
import { EMAIL_CONTATO } from '@/lib/textos';
import { cn } from '@/lib/utils';

/** Peças compartilhadas pelas telas de dados (vendas, produtos, vídeos). */

const STATUS_VARIANT: Record<OrderStatus, NonNullable<BadgeProps['variant']>> = {
  AWAITING_PAYMENT: 'aguardando',
  TO_SETTLE: 'a-liquidar',
  SETTLED: 'liquidado',
  REFUNDED: 'reembolsado',
  FROZEN: 'retido',
  INELIGIBLE: 'neutro',
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Métrica de venda nula: "ainda não disponível", nunca zero (CLAUDE.md). */
export function Indisponivel() {
  return (
    <span className="text-legenda text-texto-secundario">
      Disponível quando você conectar o TikTok Shop
    </span>
  );
}

/** Cabeçalho de página no padrão do design: título, linha de contexto e ações à direita. */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-[26px] font-extrabold tracking-tight text-texto lg:text-[28px]">
          {titulo}
        </h1>
        {descricao ? (
          <p className="text-sm text-texto-secundario lg:text-[15px]">{descricao}</p>
        ) : null}
      </div>
      {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-3">{acoes}</div> : null}
    </header>
  );
}

/** Estado "TikTok Shop não conectado": telas que dependem de pedidos mostram isto. */
export function ShopDesconectado({ oQue }: { oQue: string }) {
  return (
    <Card className="flex flex-col items-center gap-3.5 px-6 py-10 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-pessego">
        <Store className="size-7 text-apoio" aria-hidden />
      </span>
      <h2 className="text-[22px] font-extrabold tracking-tight text-texto">
        Conecte o TikTok Shop para ver {oQue}
      </h2>
      <Badge variant="neutro">Em liberação no Brasil</Badge>
      <p className="max-w-[480px] text-[15px] leading-relaxed text-texto-secundario">
        Os dados de vendas e comissões chegam pela conta do TikTok Shop. Enquanto ela não estiver
        conectada, você já consegue acompanhar os seus vídeos — e pode trazer os pedidos pelo
        relatório que o TikTok exporta em arquivo.
      </p>
      <Button asChild>
        <Link to="/configuracoes?secao=import">
          <FileUp aria-hidden /> Enviar relatório .xlsx
        </Link>
      </Button>
    </Card>
  );
}

/**
 * Selo de procedência: de onde veio o número e de quando. Um componente só, em toda
 * tela que mostra venda (CLAUDE.md → "Fontes do dado").
 */
export function Procedencia({
  source,
  sourceAt,
  className,
}: {
  source: Source;
  sourceAt: string;
  className?: string;
}) {
  const texto =
    source === 'ESTIMATED'
      ? 'Estimado'
      : source === 'FILE'
        ? `Do arquivo de ${formatData(sourceAt)}`
        : `Da API, lido em ${formatData(sourceAt)}, às ${formatHora(sourceAt)}`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] leading-normal text-texto-secundario',
        className,
      )}
    >
      <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
      {texto}
    </span>
  );
}

/** Área de conteúdo de toda tela logada: larguras e espaçamentos do design. */
export function PaginaApp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        'mx-auto flex w-full max-w-[1376px] flex-col gap-4 px-4 pb-5 pt-[18px] lg:gap-[22px] lg:px-8 lg:pb-8 lg:pt-7',
        className,
      )}
    >
      {children}
    </main>
  );
}

/** Card de indicador: rótulo, número grande e uma linha de contexto. */
export function Kpi({
  rotulo,
  valor,
  children,
  className,
}: {
  rotulo: string;
  valor: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-card border border-borda bg-superficie p-4 shadow-[0_1px_2px_rgba(43,29,27,0.04)] lg:gap-2.5 lg:px-[22px] lg:py-5',
        className,
      )}
    >
      <span className="text-[13px] font-semibold text-texto-secundario lg:text-sm">{rotulo}</span>
      <span className="text-[21px] font-extrabold tracking-tight text-texto lg:text-[30px]">
        {valor}
      </span>
      {children}
    </div>
  );
}

/** Indicador que depende do TikTok Shop: cadeado e a frase, nunca zero. */
export function KpiBloqueado({ rotulo }: { rotulo: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-dashed border-borda bg-superficie/60 p-4 lg:px-[22px] lg:py-5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-texto-secundario lg:text-sm">
        <Lock className="size-3.5" aria-hidden />
        {rotulo}
      </span>
      <span className="text-[13px] leading-snug text-texto-secundario">
        Disponível quando você conectar o TikTok Shop
      </span>
    </div>
  );
}

/** Card com título (h2) e, à direita, um complemento curto ou link. */
export function Bloco({
  titulo,
  extra,
  nota,
  children,
  className,
}: {
  titulo: string;
  extra?: ReactNode;
  /** Linha fina abaixo do gráfico, para dizer de que número ele é feito. */
  nota?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col gap-3.5 rounded-card border border-borda bg-superficie p-[18px] shadow-[0_1px_2px_rgba(43,29,27,0.04)] lg:gap-4 lg:px-[22px] lg:py-5',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-texto lg:text-[17px]">{titulo}</h2>
        {extra ? <span className="text-[13px] text-texto-secundario">{extra}</span> : null}
      </div>
      {children}
      {nota ? <p className="text-[13px] leading-relaxed text-texto-secundario">{nota}</p> : null}
    </section>
  );
}

/** Estado de erro do design: o que houve, tentar de novo, suporte e o código para o suporte. */
export function EstadoErro({
  titulo,
  error,
  onRetry,
}: {
  titulo: string;
  error: unknown;
  onRetry: () => void;
}) {
  const codigo = error instanceof ApiError ? error.code : 'desconhecido';
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-card border border-borda bg-superficie px-6 py-10 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-status-reembolsado-suave">
        <Unplug className="size-7 text-status-reembolsado" aria-hidden />
      </span>
      <h2 className="text-[22px] font-extrabold tracking-tight text-texto">{titulo}</h2>
      <p className="max-w-[480px] text-[15px] leading-relaxed text-texto-secundario">
        {error instanceof ApiError
          ? error.message
          : 'Algo deu errado. Os seus dados estão seguros: é só tentar de novo em alguns instantes.'}
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-1.5">
        <Button onClick={onRetry}>Tentar de novo</Button>
        <Button variant="secondary" asChild>
          <a href={`mailto:${EMAIL_CONTATO}`}>Falar com o suporte</a>
        </Button>
      </div>
      <p className="text-[13px] text-texto-secundario">
        Código do erro: {codigo} · {formatDataHora(new Date())}
      </p>
    </div>
  );
}

/** Estado vazio do design: ícone, título, explicação e ações. */
export function EstadoVazio({
  titulo,
  texto,
  acoes,
}: {
  titulo: string;
  texto: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-card border border-borda bg-superficie px-6 py-10 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-pessego">
        <SearchX className="size-7 text-apoio" aria-hidden />
      </span>
      <h2 className="text-[22px] font-extrabold tracking-tight text-texto">{titulo}</h2>
      <p className="max-w-[520px] text-[15px] leading-relaxed text-texto-secundario">{texto}</p>
      {acoes ? <div className="flex flex-wrap justify-center gap-3 pt-1.5">{acoes}</div> : null}
    </div>
  );
}

/** Miniatura de produto ou vídeo; sem imagem (ou com imagem quebrada), fica o fundo pêssego. */
export function Miniatura({
  url,
  rotulo,
  className = 'size-10',
}: {
  url: string | null | undefined;
  rotulo: string;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex shrink-0 overflow-hidden rounded-campo bg-pessego', className)}
      role="img"
      aria-label={rotulo}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
      ) : null}
    </span>
  );
}
