import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Heart,
  Lock,
  MessageCircle,
  Play,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import { useAllVideos, useVideo, type VideosFiltro } from '@/api/queries';
import type { Video, VideoDetail } from '@/api/schemas';
import { CurvaViews } from '@/components/charts/CurvaViews';
import {
  Bloco,
  CabecalhoPagina,
  EstadoErro,
  EstadoVazio,
  Indisponivel,
  PaginaApp,
} from '@/components/dados';
import { Busca, Carregando, Rodape, campoFiltro } from '@/components/filtros';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatData, formatHora, formatInteiro, formatMoeda } from '@/lib/format';
import { cn } from '@/lib/utils';
import { periodo, useConta, useFiltros } from './filtros';

const PAGE_SIZE = 20;

type Ordem = NonNullable<VideosFiltro['sort']>;
const ORDENS: { valor: Ordem; rotulo: string; precisaShop?: boolean }[] = [
  { valor: 'postedAt', rotulo: 'Mais recentes' },
  { valor: 'views', rotulo: 'Mais views' },
  { valor: 'gmv', rotulo: 'Maior GMV', precisaShop: true },
];

const duracao = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const hashtagsDe = (texto: string) => texto.match(/#[\p{L}\p{N}_]+/gu) ?? [];
const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function Videos() {
  const conta = useConta();
  const f = useFiltros();
  const [params] = useSearchParams();

  // Links antigos (`/videos?video=ID`) viram a página do vídeo.
  const antigo = params.get('video');
  const ordens = ORDENS.filter((o) => conta?.shopConnected || !o.precisaShop);
  const sort = ordens.find((o) => o.valor === f.get('ordem'))?.valor ?? 'postedAt';
  const hashtag = f.get('hashtag');
  const busca = f.get('q');
  const p = periodo(conta?.id ?? '', f.de, f.ate);
  const todos = useAllVideos(p);
  const query = useAllVideos(p, { sort, hashtag: hashtag ?? undefined });

  if (antigo) return <Navigate to={`/videos/${antigo}`} replace />;

  if (!conta) {
    return (
      <PaginaApp>
        <CabecalhoPagina titulo="Vídeos" />
        <EstadoVazio
          titulo="Nenhuma conta do TikTok conectada"
          texto="Conecte a sua conta em Configurações para ver os seus vídeos."
          acoes={
            <Button asChild>
              <Link to="/configuracoes">Ir para Configurações</Link>
            </Button>
          }
        />
      </PaginaApp>
    );
  }

  // Busca pelo título no front: o contrato de /videos não tem `q`.
  const lista = (query.data ?? []).filter(
    (v) => !busca || normalizar(v.title).includes(normalizar(busca)),
  );
  const pagina = lista.slice((f.pagina - 1) * PAGE_SIZE, f.pagina * PAGE_SIZE);
  const views = lista.reduce((t, v) => t + v.views, 0);

  const contagem = new Map<string, number>();
  for (const v of todos.data ?? []) {
    for (const h of new Set(hashtagsDe(v.description.toLowerCase()))) {
      contagem.set(h, (contagem.get(h) ?? 0) + 1);
    }
  }
  const hashtags = [...contagem].sort((a, b) => b[1] - a[1]).map(([h]) => h);

  return (
    <PaginaApp>
      <CabecalhoPagina
        titulo="Vídeos"
        descricao={
          query.data
            ? `${formatInteiro(lista.length)} ${lista.length === 1 ? 'vídeo' : 'vídeos'}${hashtag ? ` com #${hashtag}` : ''} · ${formatInteiro(views)} views no período`
            : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-bold text-texto-secundario">Ordenar por</span>
        <div
          role="group"
          aria-label="Ordenar vídeos"
          className="flex h-11 items-center gap-1 rounded-campo border border-borda bg-superficie p-1"
        >
          {ordens.map((o) => (
            <button
              key={o.valor}
              type="button"
              aria-pressed={sort === o.valor}
              onClick={() => f.set({ ordem: o.valor === 'postedAt' ? null : o.valor })}
              className={cn(
                'h-[34px] rounded-[6px] px-3.5 text-sm font-semibold text-texto',
                sort === o.valor && 'bg-pessego font-bold',
              )}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
        <select
          aria-label="Filtrar por hashtag"
          className={cn(campoFiltro, hashtag && 'border-[1.5px] border-acao')}
          value={hashtag ? `#${hashtag}` : ''}
          onChange={(e) => f.set({ hashtag: e.target.value.replace(/^#/, '') || null })}
        >
          <option value="">Todas as hashtags</option>
          {hashtag && !hashtags.includes(`#${hashtag}`) ? (
            <option value={`#${hashtag}`}>#{hashtag}</option>
          ) : null}
          {hashtags.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="hidden flex-1 lg:block" />
        <div className="w-full lg:w-[260px]">
          <Busca
            key={busca ?? ''}
            inicial={busca ?? ''}
            rotulo="Buscar pelo título"
            onBuscar={(q) => f.set({ q })}
          />
        </div>
      </div>

      {query.isPending ? (
        <Carregando rotulo="Carregando os seus vídeos…" />
      ) : query.error ? (
        <EstadoErro
          titulo="Não foi possível carregar os vídeos"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum vídeo por aqui"
          texto={
            hashtag || busca
              ? 'Nenhum vídeo do período combina com a busca ou a hashtag escolhida.'
              : 'Nenhum vídeo publicado no período. Tente ampliar o período no topo.'
          }
          acoes={
            hashtag || busca ? (
              <Button onClick={() => f.set({ hashtag: null, q: null })}>Limpar filtros</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
            {pagina.map((v) => (
              <li key={v.id}>
                <CardVideo video={v} />
              </li>
            ))}
          </ul>
          <Rodape
            itens={pagina.length}
            total={lista.length}
            unidade="vídeos"
            pageSize={PAGE_SIZE}
            pagina={f.pagina}
            onPagina={(n) => f.set({ pagina: String(n) })}
          />
        </>
      )}
    </PaginaApp>
  );
}

function Capa({ video: v, className }: { video: Video; className?: string }) {
  return (
    <span
      className={cn('relative block overflow-hidden bg-pessego', className)}
      role="img"
      aria-label="Capa do vídeo"
    >
      {v.coverUrl ? (
        <img
          src={v.coverUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
      ) : null}
    </span>
  );
}

const pilula = 'absolute inline-flex items-center rounded-full font-bold';

function CardVideo({ video: v }: { video: Video }) {
  // Leva os filtros junto, para o "voltar" da página do vídeo cair no mesmo lugar.
  const { search } = useLocation();
  const estatisticas: [LucideIcon, number, string][] = [
    [Eye, v.views, 'visualizações'],
    [Heart, v.likes, 'curtidas'],
    [MessageCircle, v.comments, 'comentários'],
    [Share2, v.shares, 'compartilhamentos'],
  ];
  return (
    <Link
      to={`/videos/${v.id}${search}`}
      className="flex h-full flex-col overflow-hidden rounded-card border border-borda bg-superficie no-underline hover:shadow-suave"
    >
      <span className="relative">
        <Capa video={v} className="aspect-[9/16] w-full" />
        <span
          className={cn(pilula, 'right-2 top-2 h-[22px] bg-texto/70 px-2 text-[11px] text-white')}
        >
          {duracao(v.duration)}
        </span>
        {v.gmv !== null ? (
          <span className={cn(pilula, 'bottom-2 left-2 h-6 bg-white/95 px-2.5 text-xs text-texto')}>
            {v.gmv === '0.00' ? 'Sem venda' : formatMoeda(v.gmv)}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <span className="line-clamp-2 text-sm font-bold leading-snug text-texto">
          {v.title || v.description}
        </span>
        <span className="text-xs text-texto-secundario">{formatData(v.postedAt)}</span>
        <span className="grid grid-cols-2 gap-x-2.5 gap-y-1.5">
          {estatisticas.map(([Icone, n, rotulo]) => (
            <span key={rotulo} className="inline-flex min-w-0 items-center gap-1.5">
              <Icone className="size-3.5 shrink-0 text-texto-secundario" aria-hidden />
              <span className="text-xs font-semibold text-texto">{formatInteiro(n)}</span>
              <span className="sr-only">{rotulo}</span>
            </span>
          ))}
        </span>
        {v.gmv === null ? <Indisponivel /> : null}
      </span>
    </Link>
  );
}

// --- página do vídeo ---

/** Parte das views que veio nas primeiras 48 horas, a partir dos snapshots (null sem série). */
function viewsEm48h(v: VideoDetail): number | null {
  const pontos = [...v.snapshots].sort((a, b) => a.at.localeCompare(b.at));
  const ultimo = pontos.at(-1);
  if (pontos.length < 2 || !ultimo?.views) return null;
  const limite = Date.parse(v.postedAt) + 48 * 3_600_000;
  const ate48 = pontos.filter((p) => Date.parse(p.at) <= limite).at(-1);
  if (!ate48 || ate48 === ultimo) return null;
  return Math.round((ate48.views / ultimo.views) * 100);
}

export function VideoDetalhe() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { data: v, isPending, error, refetch } = useVideo(id);
  const voltar = `/videos${params.size ? `?${params}` : ''}`;

  return (
    <PaginaApp>
      <Link
        to={voltar}
        className="inline-flex h-8 items-center gap-2 self-start text-sm font-semibold no-underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Vídeos
      </Link>

      {!v ? (
        isPending ? (
          <Skeleton className="h-96" />
        ) : (
          <EstadoErro
            titulo="Não foi possível abrir o vídeo"
            error={error}
            onRetry={() => void refetch()}
          />
        )
      ) : (
        <ConteudoVideo video={v} />
      )}
    </PaginaApp>
  );
}

function ConteudoVideo({ video: v }: { video: VideoDetail }) {
  const tags = [...new Set(hashtagsDe(v.description))].join(' ');
  const em48h = viewsEm48h(v);
  const metricas: [LucideIcon, string, number][] = [
    [Eye, 'Views', v.views],
    [Heart, 'Curtidas', v.likes],
    [MessageCircle, 'Comentários', v.comments],
    [Share2, 'Compartilhamentos', v.shares],
  ];

  return (
    <>
      <div className="-mt-2 flex flex-col gap-2.5">
        <h1 className="max-w-[760px] text-[26px] font-extrabold leading-tight tracking-tight text-texto lg:text-[28px]">
          {v.title || 'Vídeo'}
        </h1>
        <p className="text-sm text-texto-secundario lg:text-[15px]">
          Publicado em {formatData(v.postedAt)}, às {formatHora(v.postedAt)} · {duracao(v.duration)}
          {tags ? ` · ${tags}` : ''}
        </p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex w-full flex-col gap-3.5 sm:max-w-[300px] lg:w-[300px] lg:shrink-0">
          <div className="relative overflow-hidden rounded-card border border-borda">
            <Capa video={v} className="aspect-[9/16] w-full" />
            {v.shareUrl ? (
              <a
                href={v.shareUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Reproduzir o vídeo no TikTok"
                className="absolute left-1/2 top-1/2 inline-flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-texto"
              >
                <Play className="ml-1 size-7 fill-current" aria-hidden />
              </a>
            ) : null}
          </div>
          {v.shareUrl ? (
            <Button variant="secondary" asChild className="h-11 w-full">
              <a href={v.shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Abrir no TikTok
              </a>
            </Button>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {metricas.map(([Icone, rotulo, n]) => (
              <div
                key={rotulo}
                className="flex flex-col gap-1.5 rounded-card border border-borda bg-superficie px-[18px] py-4"
              >
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-texto-secundario">
                  <Icone className="size-4" aria-hidden />
                  {rotulo}
                </span>
                <span className="text-2xl font-extrabold tracking-tight text-texto">
                  {formatInteiro(n)}
                </span>
              </div>
            ))}
          </div>

          <Bloco titulo="Views ao longo do tempo" extra="Desde a publicação">
            <CurvaViews pontos={v.snapshots} />
            {em48h !== null ? (
              <p className="text-[13px] text-texto-secundario">
                {em48h}% das views aconteceram nas primeiras 48 horas.
              </p>
            ) : null}
          </Bloco>

          {v.gmv === null ? (
            <VendasBloqueadas />
          ) : (
            <Bloco titulo="Vendas e GPM">
              <p className="text-[13px] leading-relaxed text-texto-secundario">
                Valores desde o início da conta, não do período escolhido na lista.
              </p>
              <dl className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
                {(
                  [
                    ['GMV do vídeo', v.gmv],
                    ['Comissão estimada', v.commission],
                    ['GPM (GMV por mil views)', v.gpm],
                  ] as const
                ).map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex flex-col gap-1">
                    <dt className="text-[13px] font-semibold text-texto-secundario">{rotulo}</dt>
                    <dd className="text-[22px] font-extrabold tracking-tight text-texto">
                      {valor !== null ? formatMoeda(valor) : '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </Bloco>
          )}
        </div>
      </div>
    </>
  );
}

/** Vendas do vídeo sem TikTok Shop: views e engajamento seguem aparecendo acima. */
function VendasBloqueadas() {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-dashed border-borda bg-superficie/60 p-5">
      <h2 className="text-[17px] font-bold text-texto">Vendas e GPM</h2>
      <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-texto">
        <Lock className="size-4 text-apoio" aria-hidden />
        Disponível quando você conectar o TikTok Shop
      </span>
      <p className="max-w-2xl text-sm leading-relaxed text-texto-secundario">
        As views e o engajamento deste vídeo já aparecem acima. O GMV, a comissão e o GPM dependem
        dos dados de pedido, que vêm da conexão com o TikTok Shop.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="neutro">Em liberação no Brasil</Badge>
        <Button variant="secondary" size="sm" asChild>
          <Link to="/configuracoes">Ver contas conectadas</Link>
        </Button>
      </div>
    </section>
  );
}
