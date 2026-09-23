import { useState, type FormEvent } from 'react';
import { ExternalLink, Eye, Heart, ImageOff, Search } from 'lucide-react';
import { useVideo, useVideos, type VideosFiltro } from '@/api/queries';
import type { Video } from '@/api/schemas';
import { CurvaViews } from '@/components/charts/CurvaViews';
import {
  CabecalhoPagina,
  Campo,
  EstadoConsulta,
  FiltroPeriodo,
  FiltroSelect,
  Indisponivel,
  LinhaFiltros,
  Paginacao,
} from '@/components/dados';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatData, formatInteiro, formatMoeda } from '@/lib/format';
import { periodo, useConta, useFiltros } from './filtros';

// O contrato de /videos não recebe pageSize; o MSW (e o backend) usam 20.
const PAGE_SIZE = 20;

type Ordem = NonNullable<VideosFiltro['sort']>;
const ORDENS: { valor: Ordem; rotulo: string; precisaShop?: boolean }[] = [
  { valor: 'postedAt', rotulo: 'Mais recentes' },
  { valor: 'views', rotulo: 'Mais views' },
  { valor: 'gmv', rotulo: 'Maior GMV', precisaShop: true },
  { valor: 'gpm', rotulo: 'Maior GPM', precisaShop: true },
];

const duracao = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Videos() {
  const conta = useConta();
  const f = useFiltros();
  const ordens = ORDENS.filter((o) => conta?.shopConnected || !o.precisaShop);
  const sort = ordens.find((o) => o.valor === f.get('ordem'))?.valor ?? 'postedAt';
  const hashtag = f.get('hashtag');
  const videoId = f.get('video');

  const query = useVideos(periodo(conta?.id ?? '', f.de, f.ate), {
    sort,
    hashtag: hashtag ?? undefined,
    page: f.pagina,
  });
  const itens = query.data?.items ?? [];

  if (!conta) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
        <CabecalhoPagina
          titulo="Vídeos"
          descricao="Conecte sua conta do TikTok para ver seus vídeos."
        />
        <Card className="p-5">
          <p className="text-corpo-sm text-texto-secundario">
            Nenhuma conta do TikTok conectada. Conecte em Configurações.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <CabecalhoPagina
        titulo="Vídeos"
        descricao="Como cada vídeo postado no período está indo, em views e em vendas."
      />

      <LinhaFiltros>
        <FiltroPeriodo de={f.de} ate={f.ate} onChange={f.set} />
        <FiltroSelect
          rotulo="Ordenar por"
          valor={sort}
          opcoes={ordens}
          onChange={(v) => f.set({ ordem: v })}
          semTodos
        />
        <FiltroHashtag
          key={hashtag ?? ''}
          inicial={hashtag ?? ''}
          onChange={(h) => f.set({ hashtag: h })}
        />
      </LinhaFiltros>

      <EstadoConsulta
        isPending={query.isPending}
        error={query.error}
        vazio={itens.length === 0}
        mensagemVazio={
          hashtag ? `Nenhum vídeo com #${hashtag} no período.` : 'Nenhum vídeo postado no período.'
        }
        onRetry={() => void query.refetch()}
      />

      {itens.length > 0 ? (
        <ul
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
          aria-busy={query.isFetching}
        >
          {itens.map((v) => (
            <li key={v.id}>
              <CardVideo
                video={v}
                onAbrir={() => f.set({ video: v.id, pagina: String(f.pagina) })}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <Paginacao
        pagina={f.pagina}
        total={query.data?.total ?? 0}
        pageSize={PAGE_SIZE}
        onChange={(p) => f.set({ pagina: String(p) })}
      />

      <Sheet
        open={!!videoId}
        onOpenChange={(aberto) => !aberto && f.set({ video: null, pagina: String(f.pagina) })}
      >
        <SheetContent side="right" className="overflow-y-auto">
          {videoId ? <DetalheVideo id={videoId} /> : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function FiltroHashtag({
  inicial,
  onChange,
}: {
  inicial: string;
  onChange: (h: string | null) => void;
}) {
  const [valor, setValor] = useState(inicial);
  function enviar(e: FormEvent) {
    e.preventDefault();
    onChange(valor.trim().replace(/^#/, '') || null);
  }
  return (
    <form onSubmit={enviar} className="flex items-end gap-2" role="search">
      <label className="flex flex-col gap-1 text-legenda font-semibold text-texto-secundario">
        Hashtag
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="#achadinhos"
          className="h-12 w-44 text-corpo-sm"
        />
      </label>
      <Button type="submit" variant="outline" size="icon" aria-label="Filtrar por hashtag">
        <Search aria-hidden />
      </Button>
    </form>
  );
}

function Capa({ url }: { url: string | null }) {
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      // URL quebrada: some a imagem e fica o fundo.
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
      className="aspect-[9/16] w-full rounded-campo bg-fundo object-cover"
    />
  ) : (
    <span className="flex aspect-[9/16] w-full items-center justify-center rounded-campo bg-fundo text-texto-secundario">
      <ImageOff className="size-5" aria-hidden />
    </span>
  );
}

function CardVideo({ video: v, onAbrir }: { video: Video; onAbrir: () => void }) {
  return (
    <Card className="flex h-full flex-col gap-2 p-2">
      <button
        type="button"
        onClick={onAbrir}
        className="flex flex-col gap-2 rounded-campo text-left"
      >
        <Capa url={v.coverUrl} />
        <span className="line-clamp-2 px-1 text-corpo-sm font-semibold text-texto">
          {v.title || v.description}
        </span>
      </button>
      <div className="mt-auto flex flex-col gap-1 px-1 pb-1">
        <span className="text-legenda text-texto-secundario">{formatData(v.postedAt)}</span>
        <span className="flex items-center gap-3 text-legenda text-texto">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5 text-texto-secundario" aria-hidden />
            {formatInteiro(v.views)} <span className="sr-only">views</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3.5 text-texto-secundario" aria-hidden />
            {formatInteiro(v.likes)} <span className="sr-only">curtidas</span>
          </span>
        </span>
        {v.gmv !== null ? (
          <span className="text-legenda text-texto">
            <strong>{formatMoeda(v.gmv)}</strong> de GMV
            {v.gpm !== null ? ` · GPM ${formatMoeda(v.gpm)}` : ''}
          </span>
        ) : (
          <Indisponivel />
        )}
      </div>
    </Card>
  );
}

function DetalheVideo({ id }: { id: string }) {
  const { data: v, isPending, error, refetch } = useVideo(id);

  if (!v) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Vídeo</SheetTitle>
          <SheetDescription className="sr-only">Detalhe do vídeo</SheetDescription>
        </SheetHeader>
        <EstadoConsulta
          isPending={isPending}
          error={error}
          vazio={false}
          mensagemVazio=""
          onRetry={() => void refetch()}
        />
      </>
    );
  }

  const venda = (valor: string | null) => (valor !== null ? formatMoeda(valor) : <Indisponivel />);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{v.title || 'Vídeo'}</SheetTitle>
        <SheetDescription>
          Postado em {formatData(v.postedAt)} · {duracao(v.duration)}
        </SheetDescription>
      </SheetHeader>

      {v.shareUrl ? (
        <a
          href={v.shareUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 self-start text-corpo-sm font-semibold text-acao underline-offset-4 hover:underline"
        >
          Abrir no TikTok <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}

      <dl className="grid grid-cols-2 gap-3">
        <Campo rotulo="Views">{formatInteiro(v.views)}</Campo>
        <Campo rotulo="Curtidas">{formatInteiro(v.likes)}</Campo>
        <Campo rotulo="Comentários">{formatInteiro(v.comments)}</Campo>
        <Campo rotulo="Compartilhamentos">{formatInteiro(v.shares)}</Campo>
        <Campo rotulo="Vendas (GMV)">{venda(v.gmv)}</Campo>
        <Campo rotulo="Comissão estimada">{venda(v.commission)}</Campo>
        <Campo rotulo="GPM (GMV por mil views)">{venda(v.gpm)}</Campo>
      </dl>

      {v.description ? (
        <p className="whitespace-pre-line text-corpo-sm text-texto-secundario">{v.description}</p>
      ) : null}

      <CurvaViews pontos={v.snapshots} />
    </>
  );
}
