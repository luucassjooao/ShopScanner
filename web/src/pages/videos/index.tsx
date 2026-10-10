import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { Eye, Heart, MessageCircle, Share2, type LucideIcon } from 'lucide-react';
import { useAllVideos, type VideosFiltro } from '@/api/queries';
import type { Video } from '@/api/schemas';
import {
  CabecalhoPagina,
  EstadoErro,
  EstadoVazio,
  Indisponivel,
  PaginaApp,
} from '@/components/dados';
import { Busca, Carregando, Rodape, campoFiltro } from '@/components/filtros';
import { Button } from '@/components/ui/button';
import { formatData, formatInteiro, formatMoeda } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Capa } from './Capa';
import { duracao, hashtagsDe } from './pecas';
import { periodo, useConta, useFiltros } from '@/lib/filtros';

const PAGE_SIZE = 20;

type Ordem = NonNullable<VideosFiltro['sort']>;
const ORDENS: { valor: Ordem; rotulo: string; precisaShop?: boolean }[] = [
  { valor: 'postedAt', rotulo: 'Mais recentes' },
  { valor: 'views', rotulo: 'Mais views' },
  { valor: 'gmv', rotulo: 'Maior GMV', precisaShop: true },
];

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
  // Ordenar por venda aparece quando a conta tem venda; um vídeo sem venda ligada segue sem GMV, por item.
  const ordens = ORDENS.filter((o) => conta?.hasSales || !o.precisaShop);
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
