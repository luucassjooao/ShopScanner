import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CircleCheck,
  Info,
  Target,
  TrendingDown,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { OrderStatus } from '@/api/schemas';
import { CabecalhoPagina, EstadoVazio, PaginaApp, StatusBadge } from '@/components/dados';
import { Button } from '@/components/ui/button';
import { comissaoPerdidaNosAvisos, type Aviso, type TipoAviso } from '@/lib/avisos';
import { formatData, formatHora, formatMoeda } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useConta } from './filtros';
import { useAvisos } from './useAvisos';

/** Cor e ícone de cada tipo; status de pedido usam a paleta de status, sempre com rótulo. */
const VISUAL: Record<
  TipoAviso,
  { icone: LucideIcon; cor: string; fundo: string; status?: OrderStatus }
> = {
  orderSettled: {
    icone: CircleCheck,
    cor: 'text-status-liquidado border-l-status-liquidado',
    fundo: 'bg-status-liquidado-suave',
    status: 'SETTLED',
  },
  orderFrozen: {
    icone: TriangleAlert,
    cor: 'text-status-retido border-l-status-retido',
    fundo: 'bg-status-retido-suave',
    status: 'FROZEN',
  },
  orderRefunded: {
    icone: TriangleAlert,
    cor: 'text-status-reembolsado border-l-status-reembolsado',
    fundo: 'bg-status-reembolsado-suave',
    status: 'REFUNDED',
  },
  goalReached: { icone: Target, cor: 'text-acao border-l-acao', fundo: 'bg-pessego' },
  paceDrop: { icone: TrendingDown, cor: 'text-apoio border-l-apoio', fundo: 'bg-pessego' },
  viewsDrop: { icone: TrendingDown, cor: 'text-apoio border-l-apoio', fundo: 'bg-pessego' },
  postReminder: { icone: CalendarClock, cor: 'text-acao border-l-acao', fundo: 'bg-pessego' },
};

/** Nome da preferência que liga cada tipo, para a nota do rodapé. */
const PREFERENCIA: Record<TipoAviso, string> = {
  orderSettled: 'Comissão liquidada',
  orderFrozen: 'Pedido retido ou reembolsado',
  orderRefunded: 'Pedido retido ou reembolsado',
  goalReached: 'Avisar quando eu chegar a 80% e a 100% da meta',
  paceDrop: 'Queda no ritmo de vendas',
  viewsDrop: 'Queda forte de views',
  postReminder: 'Lembrete de postar',
};

export function Avisos() {
  const conta = useConta();
  const { avisos, pedidos, naoLidos, lidos, marcarTodosComoLidos, isPending } = useAvisos();

  // Abrir a página conta como ler; o destaque de "novo" fica até a próxima visita.
  useEffect(() => {
    if (avisos.length && naoLidos) {
      const t = setTimeout(marcarTodosComoLidos, 1500);
      return () => clearTimeout(t);
    }
  }, [avisos.length, naoLidos, marcarTodosComoLidos]);

  const perdidos = avisos.filter((a) => a.tipo === 'orderFrozen' || a.tipo === 'orderRefunded');
  const perda = comissaoPerdidaNosAvisos(avisos, pedidos);
  const tipos = [...new Set(avisos.map((a) => PREFERENCIA[a.tipo]))];

  return (
    <PaginaApp className="max-w-[884px]">
      <CabecalhoPagina
        titulo="Avisos"
        descricao={`${naoLidos === 1 ? '1 não lido' : `${naoLidos} não lidos`}${conta ? ` · ${conta.username}` : ''}`}
      />

      {perdidos.length ? (
        <div className="flex items-center gap-3.5 rounded-card border border-status-retido/20 bg-status-retido-suave px-5 py-4">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-superficie">
            <Info className="size-5 text-status-retido" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-texto">
            {perdidos.length === 1 ? 'Um pedido mudou' : `${perdidos.length} pedidos mudaram`} de
            status nos últimos 7 dias e {perdidos.length === 1 ? 'saiu' : 'saíram'} do seu previsto:{' '}
            <strong>{formatMoeda(perda)}</strong> a menos em comissão.
          </p>
        </div>
      ) : null}

      {isPending ? null : avisos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum aviso por enquanto"
          texto="Quando um pedido mudar de status, a meta chegar perto ou houver post marcado, o aviso aparece aqui."
          acoes={
            <Button variant="secondary" asChild>
              <Link to="/configuracoes">Escolher os avisos</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {avisos.map((a) => (
            <li key={a.id}>
              <CardAviso aviso={a} novo={!lidos.has(a.id)} />
            </li>
          ))}
        </ul>
      )}

      {tipos.length ? (
        <p className="text-[13px] leading-relaxed text-texto-secundario">
          Você recebe estes avisos enquanto {tipos.length === 1 ? 'a opção' : 'as opções'}{' '}
          {tipos.map((t, i) => (
            <span key={t}>
              {i ? (i === tipos.length - 1 ? ' e ' : ', ') : ''}
              <strong>{t}</strong>
            </span>
          ))}{' '}
          {tipos.length === 1 ? 'estiver ligada' : 'estiverem ligadas'} em{' '}
          <Link to="/configuracoes">Configurações</Link>.
        </p>
      ) : null}
    </PaginaApp>
  );
}

function CardAviso({ aviso: a, novo }: { aviso: Aviso; novo: boolean }) {
  const v = VISUAL[a.tipo];
  const Icone = v.icone;
  return (
    <article
      className={cn(
        'flex flex-wrap items-start gap-3.5 rounded-card border border-l-[3px] border-borda bg-superficie px-[18px] py-4',
        v.cor,
      )}
    >
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-[10px]',
          v.fundo,
        )}
      >
        <Icone className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="text-[15px] font-bold text-texto">{a.titulo}</span>
          {v.status ? <StatusBadge status={v.status} /> : null}
          {novo ? <span className="text-xs font-bold text-acao">Novo</span> : null}
        </span>
        <span className="text-sm leading-relaxed text-texto-secundario">{a.texto}</span>
        <span className="text-xs text-texto-secundario">
          {formatData(a.quando)}, às {formatHora(a.quando)}
          {a.detalhe ? ` · ${a.detalhe}` : ''}
        </span>
      </span>
      {a.orderId ? (
        <Button variant="secondary" size="sm" asChild className="shrink-0">
          <Link to={`/vendas?venda=${a.orderId}`}>Ver o pedido</Link>
        </Button>
      ) : a.tipo === 'postReminder' ? (
        <Button variant="secondary" size="sm" asChild className="shrink-0">
          <Link to="/planejamento">Ver o planejamento</Link>
        </Button>
      ) : null}
    </article>
  );
}
