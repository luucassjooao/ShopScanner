import { useState, type DragEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useCreatePlan, useDeletePlan, usePlans, useProducts, useUpdatePlan } from '@/api/queries';
import { planStatus, type Plan, type PlanInput, type PlanStatus } from '@/api/schemas';
import { CabecalhoPagina, EstadoConsulta, Indisponivel } from '@/components/dados';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDataHora, formatHora } from '@/lib/format';
import { PLAN_STATUS_LABEL } from '@/lib/labels';
import { dayKey } from '@/lib/metrics';
import { cn } from '@/lib/utils';
import { periodo, somarDias, useConta, useFiltros } from './filtros';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const campoNativo =
  'h-12 w-full rounded-campo border border-borda bg-superficie px-3.5 text-corpo text-texto disabled:opacity-50';

/** Segunda-feira da semana de `dia` (AAAA-MM-DD). */
function segunda(dia: string): string {
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(dia, -((semana + 6) % 7));
}

export function Planejamento() {
  const f = useFiltros();
  const plans = usePlans();
  const [aberto, setAberto] = useState<Plan | 'novo' | null>(null);
  const visao = f.get('visao') === 'calendario' ? 'calendario' : 'quadro';

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CabecalhoPagina
          titulo="Planejamento"
          descricao="Das ideias ao vídeo postado: organize o que vem pela frente."
        />
        <Button onClick={() => setAberto('novo')}>
          <Plus aria-hidden /> Nova ideia
        </Button>
      </div>

      <EstadoConsulta
        isPending={plans.isPending}
        error={plans.error}
        vazio={false}
        mensagemVazio=""
        onRetry={() => void plans.refetch()}
      />

      {plans.data ? (
        <Tabs value={visao} onValueChange={(v) => f.set({ visao: v === 'calendario' ? v : null })}>
          <TabsList>
            <TabsTrigger value="quadro">Quadro</TabsTrigger>
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
          </TabsList>
          <TabsContent value="quadro">
            <Quadro planos={plans.data} onAbrir={setAberto} />
          </TabsContent>
          <TabsContent value="calendario">
            <Calendario planos={plans.data} onAbrir={setAberto} />
          </TabsContent>
        </Tabs>
      ) : null}

      <Dialog open={aberto !== null} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {aberto !== null ? (
            <FormularioPlano
              key={aberto === 'novo' ? 'novo' : aberto.id}
              plano={aberto === 'novo' ? null : aberto}
              onFechar={() => setAberto(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

// --- quadro ---

function Quadro({ planos, onAbrir }: { planos: Plan[]; onAbrir: (p: Plan) => void }) {
  const mover = useUpdatePlan();
  const [sobre, setSobre] = useState<PlanStatus | null>(null);

  function soltar(e: DragEvent, status: PlanStatus) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData('text/plain');
    const plano = planos.find((p) => p.id === id);
    if (plano && plano.status !== status) mover.mutate({ id, status });
  }

  return (
    // No celular as colunas rolam de lado; no desktop cabem as cinco.
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:px-0">
      {planStatus.options.map((status) => {
        const doStatus = planos.filter((p) => p.status === status);
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
              'flex min-w-64 snap-start flex-col gap-2 rounded-card border border-borda bg-superficie/60 p-2 md:min-w-0',
              sobre === status && 'border-acao bg-coral-100/40',
            )}
          >
            <h2 className="flex items-center justify-between px-1 pt-1 text-corpo-sm font-bold text-texto">
              {PLAN_STATUS_LABEL[status]}
              <span className="text-legenda font-semibold text-texto-secundario">
                {doStatus.length}
              </span>
            </h2>
            {doStatus.map((p) => (
              <CardPlano key={p.id} plano={p} onAbrir={() => onAbrir(p)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function CardPlano({ plano, onAbrir }: { plano: Plan; onAbrir: () => void }) {
  const mover = useUpdatePlan();
  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', plano.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="flex cursor-grab flex-col gap-2 p-3 active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={onAbrir}
        className="text-left text-corpo-sm font-semibold text-texto hover:text-acao"
      >
        {plano.title}
      </button>
      {plano.scheduledFor ? (
        <span className="inline-flex items-center gap-1 text-legenda text-texto-secundario">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatDataHora(plano.scheduledFor)}
        </span>
      ) : null}
      {/* Arrastar não funciona no toque nem no teclado: este select faz o mesmo. */}
      <select
        aria-label={`Mover "${plano.title}" para`}
        value={plano.status}
        onChange={(e) => mover.mutate({ id: plano.id, status: e.target.value as PlanStatus })}
        className="h-9 rounded-campo border border-borda bg-superficie px-2 text-legenda text-texto"
      >
        {planStatus.options.map((s) => (
          <option key={s} value={s}>
            {PLAN_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </Card>
  );
}

// --- calendário semanal ---

function Calendario({ planos, onAbrir }: { planos: Plan[]; onAbrir: (p: Plan) => void }) {
  const f = useFiltros();
  const hoje = dayKey(new Date().toISOString());
  const semanaUrl = f.get('semana');
  const inicio = segunda(semanaUrl && /^\d{4}-\d{2}-\d{2}$/.test(semanaUrl) ? semanaUrl : hoje);
  const dias = DIAS.map((_, i) => somarDias(inicio, i));
  const semData = planos.filter((p) => !p.scheduledFor);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Semana anterior"
          onClick={() => f.set({ semana: somarDias(inicio, -7) })}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Próxima semana"
          onClick={() => f.set({ semana: somarDias(inicio, 7) })}
        >
          <ChevronRight aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => f.set({ semana: null })}>
          Esta semana
        </Button>
        <span className="text-corpo-sm font-semibold text-texto">
          {diaCurto(dias[0])} a {diaCurto(dias[6])}
        </span>
      </div>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {dias.map((d, i) => {
          const doDia = planos
            .filter((p) => p.scheduledFor && dayKey(p.scheduledFor) === d)
            .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
          return (
            <li
              key={d}
              className={cn(
                'flex min-h-28 flex-col gap-2 rounded-card border border-borda bg-superficie p-2',
                d === hoje && 'border-acao',
              )}
            >
              <span className="text-legenda font-bold text-texto-secundario">
                {DIAS[i]} {diaCurto(d)}
                {d === hoje ? <span className="text-acao"> · hoje</span> : null}
              </span>
              {doDia.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAbrir(p)}
                  className="rounded-campo bg-pessego/60 px-2 py-1 text-left text-legenda text-texto hover:bg-pessego"
                >
                  <span className="font-semibold">{formatHora(p.scheduledFor!)}</span> {p.title}
                  <span className="block text-texto-secundario">{PLAN_STATUS_LABEL[p.status]}</span>
                </button>
              ))}
            </li>
          );
        })}
      </ol>

      {semData.length ? (
        <p className="text-legenda text-texto-secundario">
          {semData.length === 1
            ? '1 ideia ainda sem data'
            : `${semData.length} ideias ainda sem data`}{' '}
          — dê uma data no quadro para ela aparecer aqui.
        </p>
      ) : null}
    </div>
  );
}

const diaCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// --- modal de roteiro ---

const formulario = z.object({
  title: z.string().trim().min(1, 'Dê um nome para a ideia.'),
  productId: z.string(),
  scheduledFor: z.string(),
  status: planStatus,
  hook: z.string(),
  scene1: z.string(),
  scene2: z.string(),
  cta: z.string(),
  caption: z.string(),
});
type Formulario = z.infer<typeof formulario>;

/** ISO UTC ↔ valor de `<input type="datetime-local">` no fuso do aparelho. */
function paraCampoData(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const ROTEIRO: {
  campo: 'hook' | 'scene1' | 'scene2' | 'cta' | 'caption';
  rotulo: string;
  dica: string;
}[] = [
  { campo: 'hook', rotulo: 'Gancho', dica: 'O que prende nos primeiros 3 segundos' },
  { campo: 'scene1', rotulo: 'Cena 1', dica: 'Mostre o produto em uso' },
  { campo: 'scene2', rotulo: 'Cena 2', dica: 'Antes e depois, comparação ou detalhe' },
  { campo: 'cta', rotulo: 'Chamada para ação (CTA)', dica: 'Ex.: link na vitrine' },
  { campo: 'caption', rotulo: 'Legenda', dica: 'Texto e hashtags do post' },
];

function FormularioPlano({ plano, onFechar }: { plano: Plan | null; onFechar: () => void }) {
  const conta = useConta();
  const hoje = dayKey(new Date().toISOString());
  // Os produtos para escolher são os que venderam nos últimos 90 dias.
  const produtos = useProducts(
    periodo(conta?.shopConnected ? conta.id : '', somarDias(hoje, -90), hoje),
  );
  const criar = useCreatePlan();
  const atualizar = useUpdatePlan();
  const excluir = useDeletePlan();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(formulario),
    defaultValues: {
      title: plano?.title ?? '',
      productId: plano?.productId ?? '',
      scheduledFor: paraCampoData(plano?.scheduledFor ?? null),
      status: plano?.status ?? 'IDEA',
      hook: plano?.script?.hook ?? '',
      scene1: plano?.script?.scene1 ?? '',
      scene2: plano?.script?.scene2 ?? '',
      cta: plano?.script?.cta ?? '',
      caption: plano?.script?.caption ?? '',
    },
  });

  const salvando = criar.isPending || atualizar.isPending;
  const falha = criar.error ?? atualizar.error ?? excluir.error;

  function salvar(v: Formulario) {
    const { hook, scene1, scene2, cta, caption } = v;
    const temRoteiro = [hook, scene1, scene2, cta, caption].some((t) => t.trim());
    const corpo: PlanInput = {
      title: v.title.trim(),
      productId: v.productId || null,
      scheduledFor: v.scheduledFor ? new Date(v.scheduledFor).toISOString() : null,
      status: v.status,
      videoId: plano?.videoId ?? null,
      notes: plano?.notes ?? null,
      script: temRoteiro ? { hook, scene1, scene2, cta, caption } : null,
    };
    const fim = { onSuccess: onFechar };
    if (plano) atualizar.mutate({ id: plano.id, ...corpo }, fim);
    else criar.mutate(corpo, fim);
  }

  const rotulo = 'flex flex-col gap-1 text-corpo-sm font-semibold text-texto';

  return (
    <form onSubmit={handleSubmit(salvar)} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{plano ? 'Editar roteiro' : 'Nova ideia'}</DialogTitle>
        <DialogDescription>
          Só o nome é obrigatório. O roteiro você completa quando quiser.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1">
        <label className={rotulo}>
          Nome da ideia
          <Input
            {...register('title')}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'erro-titulo' : undefined}
            autoFocus
          />
        </label>
        {errors.title ? (
          <span id="erro-titulo" role="alert" className="text-legenda text-status-reembolsado">
            {errors.title.message}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={rotulo}>
            Produto
            <select
              {...register('productId')}
              className={campoNativo}
              disabled={!conta?.shopConnected}
            >
              <option value="">Sem produto</option>
              {plano?.productId &&
              !produtos.data?.items.some((p) => p.productId === plano.productId) ? (
                <option value={plano.productId}>Produto {plano.productId}</option>
              ) : null}
              {produtos.data?.items.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {!conta?.shopConnected ? <Indisponivel /> : null}
        </div>
        <label className={rotulo}>
          Etapa
          <select {...register('status')} className={campoNativo}>
            {planStatus.options.map((s) => (
              <option key={s} value={s}>
                {PLAN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={rotulo}>
        Data de postagem
        <input type="datetime-local" {...register('scheduledFor')} className={campoNativo} />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-corpo-sm font-bold text-texto">Roteiro</legend>
        {ROTEIRO.map(({ campo, rotulo: r, dica }) => (
          <label key={campo} className={rotulo}>
            {r}
            <textarea
              {...register(campo)}
              rows={campo === 'caption' ? 3 : 2}
              placeholder={dica}
              className="w-full rounded-campo border border-borda bg-superficie px-3.5 py-2.5 text-corpo font-normal text-texto placeholder:text-texto-secundario/70"
            />
          </label>
        ))}
      </fieldset>

      {falha ? (
        <p role="alert" className="text-corpo-sm text-status-reembolsado">
          {falha.message}
        </p>
      ) : null}

      <DialogFooter className="sm:justify-between">
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
        ) : (
          <span />
        )}
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
