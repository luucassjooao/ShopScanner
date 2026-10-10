import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Ellipsis,
  House,
  LogOut,
  Receipt,
  RefreshCw,
  Settings,
  SquarePlay,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { ApiError } from '@/api/client';
import { useLogout } from '@/api/queries';
import type { Conta, Sessao } from '@/api/schemas';
import { useSessaoViva } from '@/auth/guarda';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDataHora, haQuanto } from '@/lib/format';
import { cn } from '@/lib/utils';
import { intervaloDoPreset, useConta, useFiltros, type Preset } from '@/lib/filtros';
import { AceiteTermos } from '@/components/AceiteTermos';
import { useAvisos } from '@/lib/useAvisos';

/**
 * Casca da área logada. Desktop: menu lateral de 248px e topo de 72px.
 * Celular: topo de 60px, período logo abaixo e barra inferior com 5 itens ("Mais" abre o resto).
 *
 * Quem barra quem não tem sessão é o `loader` da rota, em `src/auth/guarda.ts`, antes de este
 * componente existir. Aqui sobra o caso que o loader não alcança: a sessão vencer com a aba
 * aberta, sem navegação nenhuma — `useSessaoViva` cuida disso, no mesmo lugar para todos.
 */
export function AppLayout() {
  const { data, isPending, error, refetch } = useSessaoViva();

  if (isPending) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 bg-fundo p-6" aria-busy="true">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
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
    <>
      <Casca sessao={data} />
      <AceiteTermos />
    </>
  );
}

/**
 * Frescor do dado no topo: quando o backend leu a conta pela última vez. Vem de
 * `lastSyncedAt` — sem isso a creator não sabe se está olhando número velho.
 */
function AtualizadoEm({ conta }: { conta?: Conta }) {
  if (!conta?.lastSyncedAt) return null;
  return (
    <Link
      to="/configuracoes?secao=import"
      title={`Última leitura em ${formatDataHora(conta.lastSyncedAt)}`}
      className="hidden items-center gap-1.5 rounded-full border border-borda px-3 py-1.5 text-[13px] font-semibold text-texto-secundario no-underline hover:bg-fundo lg:inline-flex"
    >
      <RefreshCw className="size-3.5" aria-hidden />
      Atualizado {haQuanto(conta.lastSyncedAt)}
    </Link>
  );
}

const PRINCIPAIS: { para: string; rotulo: string; icone: LucideIcon }[] = [
  { para: '/inicio', rotulo: 'Início', icone: House },
  { para: '/vendas', rotulo: 'Vendas', icone: Receipt },
  { para: '/videos', rotulo: 'Vídeos', icone: SquarePlay },
  { para: '/produtos', rotulo: 'Produtos', icone: Tag },
];
const PLANEJAMENTO = { para: '/planejamento', rotulo: 'Planejamento', icone: CalendarDays };
const CONFIGURACOES = { para: '/configuracoes', rotulo: 'Configurações', icone: Settings };

/** Rotas cujo conteúdo depende do período escolhido no topo. */
const COM_PERIODO = ['/inicio', '/vendas', '/videos', '/produtos'];

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

function Casca({ sessao }: { sessao: Sessao }) {
  const { pathname } = useLocation();
  const comPeriodo = COM_PERIODO.includes(pathname);

  return (
    <div className="min-h-dvh bg-fundo lg:flex">
      <MenuLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topo sessao={sessao} comPeriodo={comPeriodo} />
        {comPeriodo ? (
          <div className="border-b border-borda bg-superficie px-4 py-2 lg:hidden">
            <SeletorPeriodo />
          </div>
        ) : null}
        {/* Espaço da barra inferior no celular. */}
        <div className="flex-1 pb-24 lg:pb-0">
          <Outlet context={sessao} />
        </div>
      </div>
      <BarraInferior />
    </div>
  );
}

function Logo() {
  return (
    <span className="text-[19px] font-extrabold tracking-tight">
      <span className="text-texto">Shop</span>
      <span className="text-acao">Scanner</span>
    </span>
  );
}

/** Mantém `?conta=` ao navegar entre as telas. */
function useLinkComConta() {
  const f = useFiltros();
  const conta = f.get('conta');
  return (para: string) => (conta ? `${para}?conta=${encodeURIComponent(conta)}` : para);
}

function ItemMenu({ para, rotulo, icone: Icone }: (typeof PRINCIPAIS)[number]) {
  const link = useLinkComConta();
  return (
    <NavLink
      to={link(para)}
      className={({ isActive }) =>
        cn(
          'flex h-[46px] items-center gap-3 rounded-campo px-3 text-[15px] font-medium text-texto hover:bg-fundo',
          isActive &&
            'rounded-l-none border-l-[3px] border-acao bg-fundo pl-[9px] font-bold text-acao',
        )
      }
    >
      <Icone className="size-5 shrink-0" aria-hidden />
      {rotulo}
    </NavLink>
  );
}

function useSair() {
  const logout = useLogout();
  const navigate = useNavigate();
  return () =>
    logout.mutate(undefined, { onSettled: () => navigate('/entrar', { replace: true }) });
}

function MenuLateral() {
  const sair = useSair();
  return (
    <nav
      aria-label="Menu principal"
      className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-1.5 border-r border-borda bg-superficie px-4 py-[22px] lg:flex"
    >
      <Link to="/inicio" className="px-2.5 pb-[18px]">
        <Logo />
      </Link>
      {[...PRINCIPAIS, PLANEJAMENTO].map((i) => (
        <ItemMenu key={i.para} {...i} />
      ))}
      <span className="flex-1" />
      <span className="mx-3 my-2 h-px bg-borda" />
      <ItemMenu {...CONFIGURACOES} />
      <button
        type="button"
        onClick={sair}
        className="flex h-[46px] items-center gap-3 rounded-campo px-3 text-[15px] font-medium text-texto hover:bg-fundo"
      >
        <LogOut className="size-5 shrink-0" aria-hidden />
        Sair
      </button>
    </nav>
  );
}

function Topo({ sessao, comPeriodo }: { sessao: Sessao; comPeriodo: boolean }) {
  const { naoLidos } = useAvisos();
  const contaAtiva = useConta();
  const sair = useSair();
  const link = useLinkComConta();
  const sigla = iniciais(sessao.user.name);

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-2 border-b border-borda bg-superficie pl-4 pr-3 lg:h-[72px] lg:gap-4 lg:px-8">
      <SeletorConta sessao={sessao} />
      {comPeriodo ? (
        <div className="hidden lg:block">
          <SeletorPeriodo />
        </div>
      ) : null}
      <span className="flex-1" />
      <AtualizadoEm conta={contaAtiva} />
      <Link
        to={link('/avisos')}
        aria-label={naoLidos ? `Avisos, ${naoLidos} não lidos` : 'Avisos'}
        className="relative inline-flex size-11 items-center justify-center rounded-campo text-texto hover:bg-fundo lg:border lg:border-borda"
      >
        <Bell className="size-[22px]" aria-hidden />
        {naoLidos ? (
          <span className="absolute right-2 top-2 size-[9px] rounded-full border-2 border-superficie bg-status-reembolsado" />
        ) : null}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Sua conta"
            className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pessego text-[13px] font-extrabold text-texto lg:size-11 lg:border lg:border-borda"
          >
            {sessao.user.avatarUrl ? (
              <img src={sessao.user.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              sigla
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-corpo-sm font-bold normal-case tracking-normal text-texto">
              {sessao.user.name}
            </span>
            <span className="font-normal normal-case tracking-normal">{sessao.user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to={link('/configuracoes')}>Configurações</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={sair}>Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function SeletorConta({ sessao }: { sessao: Sessao }) {
  const conta = useConta();
  const f = useFiltros();
  if (!conta) {
    return (
      <Link
        to="/configuracoes"
        className="inline-flex h-11 items-center rounded-campo border border-borda px-3.5 text-corpo-sm font-bold text-acao"
      >
        Conectar TikTok
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 min-w-0 items-center gap-2 rounded-campo border border-borda bg-superficie pl-1.5 pr-2.5 lg:shrink-0 lg:gap-2.5 lg:px-3.5"
        >
          <span className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-pessego text-xs font-extrabold text-texto">
            {iniciais(sessao.user.name)}
          </span>
          <span className="truncate text-sm font-bold text-texto">{conta.username}</span>
          <ChevronDown className="size-4 shrink-0 text-texto-secundario" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuLabel>Conta do TikTok</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={conta.id} onValueChange={(v) => f.set({ conta: v })}>
          {sessao.accounts.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id}>
              {c.username}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/configuracoes">Adicionar outra conta</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PRESETS: { valor: Preset; rotulo: string }[] = [
  { valor: '7', rotulo: '7 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
];

function SeletorPeriodo() {
  const f = useFiltros();
  // O painel de datas abre só quando a creator clica em "Personalizado".
  const [aberto, setAberto] = useState(false);

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Período"
        className="flex h-11 w-full items-center gap-1 rounded-campo border border-borda bg-superficie p-1 lg:w-auto"
      >
        {PRESETS.map((p) => {
          const ativo =
            p.valor === 'personalizado'
              ? aberto || f.preset === p.valor
              : f.preset === p.valor && !aberto;
          return (
            <button
              key={p.valor}
              type="button"
              aria-pressed={ativo}
              aria-expanded={p.valor === 'personalizado' ? aberto : undefined}
              onClick={() => {
                if (p.valor === 'personalizado') return setAberto((v) => !v);
                setAberto(false);
                f.set(intervaloDoPreset(p.valor));
              }}
              className={cn(
                'h-[34px] flex-1 whitespace-nowrap rounded-[6px] px-2 text-sm font-semibold text-texto lg:flex-none lg:px-3.5',
                ativo && 'bg-pessego font-bold',
              )}
            >
              {p.rotulo}
            </button>
          );
        })}
      </div>
      {aberto ? (
        // No desktop as datas abrem num painel abaixo, para não quebrar o topo de 72px.
        <div className="flex flex-wrap items-center gap-2 text-sm lg:absolute lg:left-0 lg:top-full lg:z-40 lg:mt-2 lg:flex-nowrap lg:rounded-card lg:border lg:border-borda lg:bg-superficie lg:p-3 lg:shadow-suave-lg">
          <label className="flex items-center gap-1.5 font-semibold text-texto-secundario">
            De
            <input
              type="date"
              value={f.de}
              max={f.ate}
              onChange={(e) => e.target.value && f.set({ de: e.target.value, ate: f.ate })}
              className="h-10 rounded-campo border border-borda bg-superficie px-2 text-texto"
            />
          </label>
          <label className="flex items-center gap-1.5 font-semibold text-texto-secundario">
            até
            <input
              type="date"
              value={f.ate}
              min={f.de}
              onChange={(e) => e.target.value && f.set({ de: f.de, ate: e.target.value })}
              className="h-10 rounded-campo border border-borda bg-superficie px-2 text-texto"
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => setAberto(false)}>
            Pronto
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BarraInferior() {
  const { pathname } = useLocation();
  const sair = useSair();
  const link = useLinkComConta();
  const noMais = [PLANEJAMENTO.para, CONFIGURACOES.para].some((r) => pathname.startsWith(r));
  const item = 'flex flex-1 basis-0 flex-col items-center justify-center gap-1 text-[11px]';

  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[72px] border-t border-borda bg-superficie shadow-[0_-4px_16px_rgba(43,29,27,0.06)] lg:hidden"
    >
      {PRINCIPAIS.map(({ para, rotulo, icone: Icone }) => (
        <NavLink
          key={para}
          to={link(para)}
          className={({ isActive }) =>
            cn(item, isActive ? 'font-bold text-acao' : 'font-semibold text-texto-secundario')
          }
        >
          <Icone className="size-[22px]" aria-hidden />
          {rotulo}
        </NavLink>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-current={noMais ? 'page' : undefined}
            className={cn(
              item,
              noMais ? 'font-bold text-acao' : 'font-semibold text-texto-secundario',
            )}
          >
            <Ellipsis className="size-[22px]" aria-hidden />
            Mais
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="mb-2 min-w-52">
          {[PLANEJAMENTO, CONFIGURACOES].map(({ para, rotulo, icone: Icone }) => (
            <DropdownMenuItem key={para} asChild>
              <Link to={link(para)} className="flex h-11 items-center gap-3">
                <Icone className="size-5" aria-hidden /> {rotulo}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={sair} className="flex h-11 items-center gap-3">
            <LogOut className="size-5" aria-hidden /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
