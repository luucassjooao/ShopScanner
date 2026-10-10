import { useState, type DragEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Ellipsis, PenLine, Plus, X } from 'lucide-react';
import { useCreatePlan, useDeletePlan, usePlans, useProducts, useUpdatePlan } from '@/api/queries';
import { planStatus, type Plan, type PlanInput, type PlanStatus } from '@/api/schemas';
import { CabecalhoPagina, EstadoErro, Miniatura, PaginaApp } from '@/components/dados';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { PLAN_STATUS_LABEL } from '@/lib/labels';
import { dayKey } from '@/lib/metrics';
import { ACAO_DA_ETAPA, deCampos, horaDaPauta, nomeDoGancho, paraCampos } from '@/lib/planos';
import { cn } from '@/lib/utils';
import { diaMesBR, hojeSP, periodo, somarDias, useConta, useFiltros } from '@/lib/filtros';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MESES = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });

/** Segunda-feira da semana de `dia` (AAAA-MM-DD). */
function segunda(dia: string): string {
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(dia, -((semana + 6) % 7));
}

/** "21 a 27 de setembro de 2026" (ou "28 de setembro a 4 de outubro de 2026"). */
function rotuloSemana(inicio: string) {
  const fim = somarDias(inicio, 6);
  const mes = (d: string) => MESES.format(new Date(`${d}T00:00:00Z`));
  const dia = (d: string) => Number(d.slice(8, 10));
  return mes(inicio) === mes(fim)
    ? `${dia(inicio)} a ${dia(fim)} de ${mes(fim)} de ${fim.slice(0, 4)}`
    : `${dia(inicio)} de ${mes(inicio)} a ${dia(fim)} de ${mes(fim)} de ${fim.slice(0, 4)}`;
}

/** Produtos para escolher e para mostrar nos cards: os que venderam nos últimos 90 dias. */
function useProdutosRecentes() {
  const conta = useConta();
  const hoje = hojeSP();
  // A consulta sempre acontece; `hasSales` só decide se há o que escolher e o aviso a mostrar.
  const q = useProducts(periodo(conta?.id ?? '', somarDias(hoje, -89), hoje));
  return {
    lista: q.data?.items ?? [],
    temVenda: !!conta?.hasSales,
    carregando: !!conta && q.isPending,
  };
}

type Aberto = { plano: Plan } | { novo: PlanStatus; produtoId?: string } | null;

export function Planejamento() {
  const f = useFiltros();
  const plans = usePlans();
  const [aberto, setAberto] = useState<Aberto>(() =>
    f.get('novo') ? { novo: 'SCRIPT', produtoId: f.get('produto') ?? undefined } : null,
  );
  const hoje = hojeSP();
  const inicioSemana = segunda(hoje);
  const planos = plans.data ?? [];
  const emAndamento = planos.filter((p) => p.status !== 'POSTED').length;
  const nestaSemana = planos.filter(
    (p) =>
      p.scheduledFor &&
      p.status !== 'POSTED' &&
      dayKey(p.scheduledFor) >= inicioSemana &&
      dayKey(p.scheduledFor) <= somarDias(inicioSemana, 6),
  ).length;

  function fechar() {
    setAberto(null);
    if (f.get('novo')) f.set({ novo: null, produto: null });
  }

  return (
    <PaginaApp>
      <CabecalhoPagina
        titulo="Planejamento"
        descricao={
          plans.data
            ? `${emAndamento} ${emAndamento === 1 ? 'pauta' : 'pautas'} em andamento · ${nestaSemana} ${nestaSemana === 1 ? 'publicação marcada' : 'publicações marcadas'} para esta semana`
            : undefined
        }
        acoes={
          <>
            <Button className="hidden lg:inline-flex" onClick={() => setAberto({ novo: 'SCRIPT' })}>
              <Plus aria-hidden /> Criar roteiro
            </Button>
            <Button
              size="icon"
              className="size-12 lg:hidden"
              aria-label="Criar roteiro"
              onClick={() => setAberto({ novo: 'SCRIPT' })}
            >
              <Plus aria-hidden />
            </Button>
          </>
        }
      />

      {plans.isPending ? (
        <Skeleton className="h-80 rounded-card" />
      ) : plans.error ? (
        <EstadoErro
          titulo="Não foi possível carregar o planejamento"
          error={plans.error}
          onRetry={() => void plans.refetch()}
        />
      ) : (
        <>
          <Quadro planos={planos} onAbrir={setAberto} />
          <Calendario planos={planos} onAbrir={(p) => setAberto({ plano: p })} />
        </>
      )}

      <Dialog open={aberto !== null} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="flex max-h-[92dvh] max-w-[720px] flex-col gap-0 overflow-hidden rounded-2xl p-0 [&>button:last-child]:hidden">
          {aberto ? (
            <FormularioPlano
              key={'plano' in aberto ? aberto.plano.id : `novo-${aberto.novo}`}
              plano={'plano' in aberto ? aberto.plano : null}
              etapaNova={'novo' in aberto ? aberto.novo : 'SCRIPT'}
              produtoInicial={'novo' in aberto ? aberto.produtoId : undefined}
              onFechar={fechar}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </PaginaApp>
  );
}

// --- quadro ---

function Quadro({ planos, onAbrir }: { planos: Plan[]; onAbrir: (a: Aberto) => void }) {
  const mover = useUpdatePlan();
  const f = useFiltros();
  const [sobre, setSobre] = useState<PlanStatus | null>(null);
  const { lista: produtos } = useProdutosRecentes();
  const nomeProduto = (id: string | null) => produtos.find((p) => p.productId === id)?.name;
  const etapaCelular = planStatus.safeParse(f.get('etapa')).data ?? 'IDEA';

  function soltar(e: DragEvent, status: PlanStatus) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData('text/plain');
    const plano = planos.find((p) => p.id === id);
    if (plano && plano.status !== status) mover.mutate({ id, status });
  }

  const cards = (status: PlanStatus) =>
    planos
      .filter((p) => p.status === status)
      .map((p) => (
        <CardPlano
          key={p.id}
          plano={p}
          produto={nomeProduto(p.productId)}
          onAbrir={() => onAbrir({ plano: p })}
        />
      ));

  return (
    <>
      {/* Desktop: cinco colunas com arrastar. */}
      <div className="hidden items-start gap-4 lg:flex">
        {planStatus.options.map((status) => {
          const n = planos.filter((p) => p.status === status).length;
          return (
            <section
              key={status}
              aria-label={PLAN_STATUS_LABEL[status]}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(status);
              }}
              onDragLeave={() => setSobre((s) => (s === status ? null : s))}
              onDrop={(e) => soltar(e, status)}
              className={cn(
                'flex min-w-0 flex-1 basis-0 flex-col gap-2.5 rounded-card border border-borda bg-fundo p-3',
                sobre === status && 'border-acao bg-coral-100/50',
              )}
            >
              <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-texto">
                {PLAN_STATUS_LABEL[status]}
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-borda px-1.5 text-xs font-bold text-texto-secundario">
                  {n}
                </span>
              </h2>
              {cards(status)}
              <BotaoAdicionar onClick={() => onAbrir({ novo: status })}>Adicionar</BotaoAdicionar>
            </section>
          );
        })}
      </div>

      {/* Celular: uma etapa por vez, escolhida nos chips. */}
      <div className="flex flex-col gap-3.5 lg:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {planStatus.options.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={etapaCelular === status}
              onClick={() => f.set({ etapa: status })}
              className={cn(
                'h-10 shrink-0 whitespace-nowrap rounded-full border border-borda bg-superficie px-3.5 text-sm font-semibold text-texto',
                etapaCelular === status && 'border-[1.5px] border-acao bg-pessego font-bold',
              )}
            >
              {PLAN_STATUS_LABEL[status]} · {planos.filter((p) => p.status === status).length}
            </button>
          ))}
        </div>
        <section aria-label={PLAN_STATUS_LABEL[etapaCelular]} className="flex flex-col gap-2.5">
          {cards(etapaCelular)}
          <BotaoAdicionar onClick={() => onAbrir({ novo: etapaCelular })}>
            Adicionar em {PLAN_STATUS_LABEL[etapaCelular]}
          </BotaoAdicionar>
        </section>
      </div>
    </>
  );
}

function BotaoAdicionar({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-campo border border-dashed border-borda text-[13px] font-semibold text-texto-secundario hover:border-acao hover:text-acao lg:h-10"
    >
      <Plus className="size-4" aria-hidden />
      {children}
    </button>
  );
}

function CardPlano({
  plano,
  produto,
  onAbrir,
}: {
  plano: Plan;
  produto: string | undefined;
  onAbrir: () => void;
}) {
  const mover = useUpdatePlan();
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', plano.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="relative flex cursor-grab flex-col gap-2 rounded-card border border-borda bg-superficie p-3 active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={onAbrir}
        className="pr-7 text-left text-sm font-bold leading-snug text-texto hover:text-acao"
      >
        {plano.title}
      </button>
      {produto || plano.scheduledFor ? (
        <span className="flex items-center gap-2">
          {produto ? (
            <>
              <Miniatura url={null} rotulo="Imagem do produto" className="size-6 rounded-[6px]" />
              <span className="min-w-0 flex-1 truncate text-xs text-texto-secundario">
                {produto}
              </span>
            </>
          ) : (
            <span className="flex-1" />
          )}
          {plano.scheduledFor ? (
            <span className="inline-flex h-[22px] items-center rounded-full bg-pessego px-2 text-[11px] font-bold text-texto">
              {diaMesBR(dayKey(plano.scheduledFor))}
            </span>
          ) : null}
        </span>
      ) : null}
      {/* Arrastar não funciona no toque nem no teclado: este menu faz o mesmo. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Mover "${plano.title}"`}
            className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-campo text-texto-secundario hover:bg-fundo"
          >
            <Ellipsis className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Mover para</DropdownMenuLabel>
          {planStatus.options
            .filter((s) => s !== plano.status)
            .map((s) => (
              <DropdownMenuItem key={s} onSelect={() => mover.mutate({ id: plano.id, status: s })}>
                {PLAN_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// --- calendário semanal ---

function Calendario({ planos, onAbrir }: { planos: Plan[]; onAbrir: (p: Plan) => void }) {
  const f = useFiltros();
  const hoje = hojeSP();
  const semanaUrl = f.get('semana');
  const inicio = segunda(semanaUrl && /^\d{4}-\d{2}-\d{2}$/.test(semanaUrl) ? semanaUrl : hoje);
  const dias = DIAS.map((_, i) => somarDias(inicio, i));
  const doDia = (d: string) =>
    planos
      .filter((p) => p.scheduledFor && dayKey(p.scheduledFor) === d)
      .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));

  const item = (p: Plan) => (
    <button
      key={p.id}
      type="button"
      onClick={() => onAbrir(p)}
      className="flex w-full flex-col gap-0.5 rounded-campo border border-l-[3px] border-borda border-l-acao bg-superficie px-3 py-2.5 text-left hover:bg-fundo"
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-acao">
        {ACAO_DA_ETAPA[p.status]} · {horaDaPauta(p.scheduledFor!)}
      </span>
      <span className="text-[13px] font-semibold leading-snug text-texto lg:text-[13px]">
        {p.title}
      </span>
    </button>
  );
  const nada = <span className="block py-2 text-xs text-texto-secundario">Nada marcado</span>;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-borda bg-superficie p-[18px] lg:px-[22px] lg:py-5">
      <div className="flex items-center gap-2 lg:gap-3">
        <h2 className="flex-1 text-base font-bold text-texto lg:text-[17px]">
          <span className="hidden lg:inline">Semana de </span>
          {rotuloSemana(inicio)}
        </h2>
        <Button
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Semana anterior"
          onClick={() => f.set({ semana: somarDias(inicio, -7) })}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Próxima semana"
          onClick={() => f.set({ semana: somarDias(inicio, 7) })}
        >
          <ArrowRight aria-hidden />
        </Button>
      </div>

      {/* Desktop: sete colunas. */}
      <ol className="hidden gap-3 lg:flex">
        {dias.map((d, i) => (
          <li key={d} className="flex min-w-0 flex-1 basis-0 flex-col gap-2">
            <span
              className={cn(
                'flex items-baseline gap-1.5 border-b-2 pb-1.5',
                d === hoje ? 'border-acao' : 'border-borda',
              )}
            >
              <span
                className={cn(
                  'text-[13px]',
                  d === hoje ? 'font-extrabold text-texto' : 'font-semibold text-texto-secundario',
                )}
              >
                {DIAS[i]}
                {d === hoje ? <span className="sr-only"> (hoje)</span> : null}
              </span>
              <span className="text-xs text-texto-secundario">{diaMesBR(d)}</span>
            </span>
            {doDia(d).length ? doDia(d).map(item) : nada}
          </li>
        ))}
      </ol>

      {/* Celular: um dia por linha. */}
      <ol className="flex flex-col gap-3 lg:hidden">
        {dias.map((d, i) => (
          <li key={d} className="flex items-start gap-3">
            <span className="flex w-14 shrink-0 flex-col pt-0.5">
              <span
                className={cn(
                  'text-[13px]',
                  d === hoje ? 'font-extrabold text-texto' : 'font-semibold text-texto-secundario',
                )}
              >
                {DIAS[i]}
                {d === hoje ? <span className="sr-only"> (hoje)</span> : null}
              </span>
              <span className="text-xs text-texto-secundario">{diaMesBR(d)}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              {doDia(d).length ? doDia(d).map(item) : nada}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// --- modal de roteiro ---

interface Campos {
  productId: string;
  data: string;
  hora: string;
  hook: string;
  scene1: string;
  scene2: string;
  cta: string;
  caption: string;
}

const ROTEIRO: {
  campo: 'hook' | 'scene1' | 'scene2' | 'cta' | 'caption';
  rotulo: string;
  linhas: number;
  dica: string;
}[] = [
  { campo: 'hook', rotulo: 'Gancho', linhas: 2, dica: 'O que prende nos primeiros 3 segundos' },
  { campo: 'scene1', rotulo: 'Cena 1', linhas: 3, dica: 'Mostre o produto em uso' },
  { campo: 'scene2', rotulo: 'Cena 2', linhas: 3, dica: 'Antes e depois, comparação ou detalhe' },
  { campo: 'cta', rotulo: 'CTA', linhas: 2, dica: 'Ex.: link fixado no perfil' },
  { campo: 'caption', rotulo: 'Legenda', linhas: 3, dica: 'Texto e hashtags do post' },
];

const campo =
  'w-full rounded-campo border border-borda bg-superficie px-3.5 text-[15px] text-texto placeholder:text-texto-secundario/70 disabled:opacity-50';

function FormularioPlano({
  plano,
  etapaNova,
  produtoInicial,
  onFechar,
}: {
  plano: Plan | null;
  etapaNova: PlanStatus;
  produtoInicial?: string;
  onFechar: () => void;
}) {
  const { lista: produtos, temVenda, carregando } = useProdutosRecentes();
  const criar = useCreatePlan();
  const atualizar = useUpdatePlan();
  const excluir = useDeletePlan();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  // O nome acompanha o gancho até a creator renomear (CLAUDE.md).
  const [nome, setNome] = useState(plano?.title ?? '');
  const [renomeado, setRenomeado] = useState(!!plano);
  const inicio = paraCampos(plano?.scheduledFor ?? null);

  const { register, handleSubmit, watch } = useForm<Campos>({
    defaultValues: {
      productId: plano?.productId ?? produtoInicial ?? '',
      data: inicio.data,
      hora: inicio.hora,
      hook: plano?.script?.hook ?? '',
      scene1: plano?.script?.scene1 ?? '',
      scene2: plano?.script?.scene2 ?? '',
      cta: plano?.script?.cta ?? '',
      caption: plano?.script?.caption ?? '',
    },
  });
  const derivado = nomeDoGancho(watch('hook'));
  // Nome apagado volta a seguir o gancho ao salvar.
  const titulo = (renomeado && nome.trim()) || derivado;

  const salvando = criar.isPending || atualizar.isPending;
  const falha = criar.error ?? atualizar.error ?? excluir.error;
  const etapa = plano?.status ?? etapaNova;

  function salvar(v: Campos) {
    const { hook, scene1, scene2, cta, caption } = v;
    const temRoteiro = [hook, scene1, scene2, cta, caption].some((t) => t.trim());
    const corpo: PlanInput = {
      title: titulo,
      productId: v.productId || null,
      scheduledFor: deCampos(v.data, v.hora),
      status: etapa,
      videoId: plano?.videoId ?? null,
      notes: plano?.notes ?? null,
      script: temRoteiro ? { hook, scene1, scene2, cta, caption } : null,
    };
    const fim = { onSuccess: onFechar };
    if (plano) atualizar.mutate({ id: plano.id, ...corpo }, fim);
    else criar.mutate(corpo, fim);
  }

  return (
    <form onSubmit={handleSubmit(salvar)} className="flex min-h-0 flex-col" noValidate>
      <div className="flex shrink-0 items-center gap-3 border-b border-borda px-5 py-4 lg:px-[26px] lg:py-[22px]">
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogTitle className="sr-only">{plano ? 'Editar roteiro' : 'Novo roteiro'}</DialogTitle>
          <span className="text-xs font-semibold text-texto-secundario">
            {plano ? 'Editar roteiro' : 'Novo roteiro'}
          </span>
          <label className="flex items-center gap-2">
            <span className="sr-only">Nome da pauta</span>
            <input
              value={renomeado ? nome : derivado}
              placeholder={derivado}
              onChange={(e) => {
                setRenomeado(true);
                setNome(e.target.value);
              }}
              className="-mx-1 min-w-0 flex-1 rounded-campo border border-transparent bg-transparent px-1 text-xl font-extrabold tracking-tight text-texto hover:border-borda focus:border-borda lg:text-[22px]"
            />
            <PenLine className="size-4 shrink-0 text-texto-secundario" aria-hidden />
          </label>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-campo border border-borda text-texto hover:bg-fundo"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <DialogDescription className="sr-only">
        O nome acompanha o gancho até você renomear.
      </DialogDescription>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 lg:px-[26px] lg:py-[22px]">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
          Produto
          {/* Remonta quando a lista chega, para o valor inicial (ex.: vindo de Produtos) pegar. */}
          <select
            key={carregando ? 'carregando' : 'pronto'}
            {...register('productId')}
            className={cn(campo, 'h-12')}
            disabled={!temVenda || carregando}
          >
            <option value="">Sem produto</option>
            {plano?.productId && !produtos.some((p) => p.productId === plano.productId) ? (
              <option value={plano.productId}>Produto {plano.productId}</option>
            ) : null}
            {produtos.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.name} · {p.shopName}
              </option>
            ))}
          </select>
          {!temVenda ? (
            <span className="text-xs font-normal text-texto-secundario">
              Disponível quando a conta tiver vendas: envie o relatório em Configurações
            </span>
          ) : null}
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
            Data de publicação
            <input type="date" {...register('data')} className={cn(campo, 'h-12')} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
            Horário
            <input type="time" {...register('hora')} className={cn(campo, 'h-12 w-32')} />
          </label>
        </div>
        {ROTEIRO.map(({ campo: c, rotulo, linhas, dica }) => (
          <label key={c} className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
            {rotulo}
            <textarea
              {...register(c)}
              rows={linhas}
              placeholder={dica}
              className={cn(campo, 'resize-none py-3 font-normal leading-relaxed')}
            />
          </label>
        ))}
        {falha ? (
          <p role="alert" className="text-sm text-status-reembolsado">
            {falha.message}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-borda px-5 py-4 lg:px-[26px] lg:py-[18px]">
        <span className="hidden flex-1 text-[13px] text-texto-secundario sm:block">
          {plano
            ? `Pauta na etapa ${PLAN_STATUS_LABEL[etapa]}.`
            : `O roteiro entra na coluna ${PLAN_STATUS_LABEL[etapa]} e aparece no calendário da semana.`}
        </span>
        {plano ? (
          confirmandoExclusao ? (
            <Button
              variant="destructive"
              disabled={excluir.isPending}
              onClick={() => excluir.mutate(plano.id, { onSuccess: onFechar })}
            >
              Confirmar exclusão
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmandoExclusao(true)}>
              Excluir
            </Button>
          )
        ) : null}
        <Button variant="outline" onClick={onFechar} className="ml-auto sm:ml-0">
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar roteiro'}
        </Button>
      </div>
    </form>
  );
}
