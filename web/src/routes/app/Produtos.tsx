import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, ExternalLink, PenLine, RotateCcw } from 'lucide-react';
import {
  buscarTodosProdutos,
  useCreatePlan,
  useProduct,
  useProducts,
  type ProductsFiltro,
} from '@/api/queries';
import type { ProductDetail, ProductRow } from '@/api/schemas';
import {
  CabecalhoPagina,
  EstadoErro,
  EstadoVazio,
  Miniatura,
  PaginaApp,
  ShopDesconectado,
} from '@/components/dados';
import { Busca, Carregando, ChipsFiltro, Rodape, campoFiltro } from '@/components/filtros';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { baixarArquivo, percentual, produtosCsv } from '@/lib/csv';
import { formatData, formatInteiro, formatMoeda, formatTaxa } from '@/lib/format';
import { CHANNEL_LABEL } from '@/lib/labels';
import { useDesktop } from '@/lib/useMedia';
import { cn } from '@/lib/utils';
import { intervaloDoPreset, periodo, useConta, useFiltros } from './filtros';

// O contrato de /products não recebe pageSize; o MSW (e o backend) usam 20.
const PAGE_SIZE = 20;

type Ordem = NonNullable<ProductsFiltro['sort']>;
const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'gmv', rotulo: 'Ordenar: maior GMV' },
  { valor: 'commission', rotulo: 'Maior comissão' },
  { valor: 'units', rotulo: 'Mais itens vendidos' },
  { valor: 'refunds', rotulo: 'Mais reembolsos' },
];

export function Produtos() {
  const conta = useConta();
  const f = useFiltros();
  const desktop = useDesktop();
  const sort = ORDENS.find((o) => o.valor === f.get('ordem'))?.valor ?? 'gmv';
  const loja = f.get('loja');
  const busca = f.get('q');
  const produtoId = f.get('produto');

  const p = periodo(conta?.shopConnected ? conta.id : '', f.de, f.ate);
  const filtro = { sort, shopName: loja ?? undefined, q: busca ?? undefined };
  const query = useProducts(p, { ...filtro, page: f.pagina });
  const semFiltro = useProducts(p);
  const [exportando, setExportando] = useState(false);

  if (!conta?.shopConnected) {
    return (
      <PaginaApp>
        <CabecalhoPagina titulo="Produtos" />
        <ShopDesconectado oQue="os seus produtos" />
      </PaginaApp>
    );
  }

  const itens = query.data?.items ?? [];
  // Lojas para o filtro: as que aparecem nos produtos do período.
  const lojas = [...new Set(semFiltro.data?.items.map((x) => x.shopName))].sort();
  const temFiltro = !!(loja || busca);
  const abrir = (id: string) => f.set({ produto: id, pagina: String(f.pagina) });
  const chips = [
    {
      nome: 'período',
      rotulo: f.rotuloPeriodo,
      remover: f.preset === '30' ? undefined : () => f.set(intervaloDoPreset('30')),
    },
    ...(loja
      ? [{ nome: 'loja', rotulo: `Loja: ${loja}`, remover: () => f.set({ loja: null }) }]
      : []),
    ...(busca
      ? [{ nome: 'busca', rotulo: `Busca: ${busca}`, remover: () => f.set({ q: null }) }]
      : []),
  ];

  async function exportar() {
    setExportando(true);
    try {
      baixarArquivo(
        produtosCsv(await buscarTodosProdutos(p, filtro)),
        `produtos-${f.de}-a-${f.ate}.csv`,
      );
    } finally {
      setExportando(false);
    }
  }

  return (
    <PaginaApp>
      <CabecalhoPagina
        titulo="Produtos"
        descricao={
          query.data
            ? `${formatInteiro(query.data.total)} produtos com venda · ${f.rotuloPeriodo.toLowerCase()}`
            : undefined
        }
        acoes={
          <Button
            variant="secondary"
            size="sm"
            onClick={exportar}
            disabled={exportando || !itens.length}
          >
            <Download aria-hidden /> {exportando ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-3 lg:p-4">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <select
            aria-label="Ordenar produtos"
            className={campoFiltro}
            value={sort}
            onChange={(e) => f.set({ ordem: e.target.value === 'gmv' ? null : e.target.value })}
          >
            {ORDENS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por loja"
            className={campoFiltro}
            value={loja ?? ''}
            onChange={(e) => f.set({ loja: e.target.value || null })}
          >
            <option value="">Todas as lojas</option>
            {loja && !lojas.includes(loja) ? <option value={loja}>{loja}</option> : null}
            {lojas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <Busca
            key={busca ?? ''}
            inicial={busca ?? ''}
            rotulo="Buscar produto ou loja"
            onBuscar={(q) => f.set({ q })}
          />
        </div>
        <ChipsFiltro
          chips={chips}
          onLimpar={temFiltro ? () => f.set({ loja: null, q: null }) : undefined}
        />
      </div>

      {query.isPending ? (
        <Carregando rotulo="Carregando os seus produtos…" />
      ) : query.error ? (
        <EstadoErro
          titulo="Não foi possível carregar os produtos"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : itens.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum produto vendido"
          texto={
            temFiltro
              ? 'Nenhum produto combina com a busca ou a loja escolhida.'
              : 'Nenhum produto teve venda no período. Tente ampliar o período no topo.'
          }
          acoes={
            temFiltro ? (
              <Button onClick={() => f.set({ loja: null, q: null })}>Limpar filtros</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <TabelaProdutos itens={itens} onAbrir={abrir} />
          <ListaProdutos itens={itens} onAbrir={abrir} />
          <Rodape
            itens={itens.length}
            total={query.data?.total ?? 0}
            unidade="produtos"
            pageSize={PAGE_SIZE}
            pagina={f.pagina}
            onPagina={(n) => f.set({ pagina: String(n) })}
          />
        </>
      )}

      <Sheet
        open={!!produtoId}
        onOpenChange={(aberto) => !aberto && f.set({ produto: null, pagina: String(f.pagina) })}
      >
        <SheetContent
          side={desktop ? 'right' : 'bottom'}
          className={cn('overflow-y-auto', desktop ? 'sm:max-w-[448px]' : 'max-h-[680px]')}
        >
          {produtoId ? <DetalheProduto id={produtoId} /> : null}
        </SheetContent>
      </Sheet>
    </PaginaApp>
  );
}

const reembolsos = (p: ProductRow) =>
  `${formatInteiro(p.refundedUnits)} · ${percentual(p.refundedUnits, p.units)}`;

const th = 'h-11 px-3 text-left text-xs font-bold uppercase tracking-wide text-texto-secundario';
const td = 'px-3 py-3 align-middle';

function TabelaProdutos({
  itens,
  onAbrir,
}: {
  itens: ProductRow[];
  onAbrir: (id: string) => void;
}) {
  return (
    <div className="relative hidden overflow-x-auto rounded-card border border-borda bg-superficie md:block">
      <table className="w-full text-sm">
        <thead className="border-b border-borda">
          <tr>
            <th className={th}>Produto</th>
            <th className={th}>Loja</th>
            <th className={cn(th, 'text-right')}>Itens</th>
            <th className={cn(th, 'text-right')}>GMV</th>
            <th className={cn(th, 'text-right')}>Comissão</th>
            <th className={cn(th, 'text-right')}>Taxa</th>
            <th className={cn(th, 'text-right')}>Reembolsos</th>
            <th className={th}>Canal que mais vendeu</th>
            <th className={th}>
              <span className="sr-only">Detalhe</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((p) => (
            <tr key={p.productId} className="border-b border-borda last:border-0 hover:bg-fundo">
              <td className={cn(td, 'min-w-64')}>
                <span className="flex items-center gap-3">
                  <Miniatura url={p.imageUrl} rotulo="Imagem do produto" />
                  <button
                    type="button"
                    onClick={() => onAbrir(p.productId)}
                    className="text-left font-semibold text-texto hover:text-acao"
                  >
                    {p.name}
                  </button>
                </span>
              </td>
              <td className={cn(td, 'whitespace-nowrap text-texto-secundario')}>{p.shopName}</td>
              <td className={cn(td, 'text-right tabular-nums')}>{formatInteiro(p.units)}</td>
              <td className={cn(td, 'whitespace-nowrap text-right font-semibold tabular-nums')}>
                {formatMoeda(p.gmv)}
              </td>
              <td className={cn(td, 'whitespace-nowrap text-right tabular-nums')}>
                {formatMoeda(p.commission)}
              </td>
              <td className={cn(td, 'text-right tabular-nums text-texto-secundario')}>
                {formatTaxa(p.commissionRate, { casas: 1 })}
              </td>
              <td className={cn(td, 'whitespace-nowrap text-right tabular-nums')}>
                {reembolsos(p)}
              </td>
              <td className={cn(td, 'whitespace-nowrap')}>
                {p.topChannel ? CHANNEL_LABEL[p.topChannel] : '—'}
              </td>
              <td className={td}>
                <button
                  type="button"
                  onClick={() => onAbrir(p.productId)}
                  aria-label={`Abrir detalhe de ${p.name}`}
                  className="inline-flex size-9 items-center justify-center rounded-campo text-acao hover:bg-fundo"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaProdutos({ itens, onAbrir }: { itens: ProductRow[]; onAbrir: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-2.5 md:hidden">
      {itens.map((p) => (
        <li key={p.productId}>
          <button
            type="button"
            onClick={() => onAbrir(p.productId)}
            className="flex w-full items-start gap-3 rounded-card border border-borda bg-superficie p-3 text-left"
          >
            <Miniatura url={p.imageUrl} rotulo="Imagem do produto" className="size-12" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-bold leading-snug text-texto">{p.name}</span>
              <span className="text-xs text-texto-secundario">
                {p.shopName} · {formatInteiro(p.units)} itens · reembolsos {reembolsos(p)}
              </span>
              {p.topChannel ? (
                <span className="text-xs text-texto-secundario">
                  Mais vendeu por {CHANNEL_LABEL[p.topChannel]}
                </span>
              ) : null}
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="font-bold tabular-nums text-texto">{formatMoeda(p.gmv)}</span>
              <span className="text-xs text-texto-secundario">{formatMoeda(p.commission)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DetalheProduto({ id }: { id: string }) {
  const { data: p, isPending, error, refetch } = useProduct(id);
  if (!p) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Detalhe do produto</SheetTitle>
          <SheetDescription className="sr-only">Detalhe do produto</SheetDescription>
        </SheetHeader>
        {isPending ? (
          <Skeleton className="h-64" />
        ) : (
          <EstadoErro
            titulo="Não foi possível abrir o produto"
            error={error}
            onRetry={() => void refetch()}
          />
        )}
      </>
    );
  }
  return <ConteudoProduto produto={p} />;
}

function ConteudoProduto({ produto: p }: { produto: ProductDetail }) {
  const criar = useCreatePlan();
  const indicadores: [string, string][] = [
    ['GMV', formatMoeda(p.gmv)],
    ['Itens vendidos', formatInteiro(p.units)],
    ['Comissão estimada', formatMoeda(p.commission)],
    ['Taxa atual', formatTaxa(p.commissionRate, { casas: 1 })],
    ['Reembolsos', reembolsos(p)],
    ['Vídeos com o produto', formatInteiro(p.videos.length)],
  ];

  // "Marcar para regravar" não é campo novo: vira uma pauta em Ideia com o produto (CLAUDE.md).
  function regravar() {
    criar.mutate(
      {
        title: `Regravar: ${p.name}`,
        productId: p.productId,
        status: 'IDEA',
        scheduledFor: null,
        videoId: null,
        script: null,
        notes: null,
      },
      {
        onSuccess: () =>
          toast({
            title: 'Pauta criada em Ideia',
            description: 'Ela já está no seu Planejamento.',
          }),
      },
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-lg font-bold">Detalhe do produto</SheetTitle>
        <SheetDescription className="sr-only">
          Indicadores e vídeos que promoveram o produto
        </SheetDescription>
      </SheetHeader>

      <div className="flex items-start gap-3">
        <Miniatura url={p.imageUrl} rotulo="Imagem do produto" className="size-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-bold text-texto">{p.name}</span>
          <span className="text-[13px] text-texto-secundario">{p.shopName}</span>
          {p.topChannel ? (
            <span className="text-[13px] text-texto-secundario">
              Canal que mais vendeu:{' '}
              <strong className="text-texto">{CHANNEL_LABEL[p.topChannel]}</strong>
            </span>
          ) : null}
          {p.detailUrl ? (
            <a
              href={p.detailUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-semibold"
            >
              Ver na loja <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <p className="-mb-2 text-[13px] leading-relaxed text-texto-secundario">
        Totais desde o início da conta. A lista mostra o período escolhido.
      </p>
      <dl className="grid grid-cols-2 gap-3">
        {indicadores.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex flex-col gap-1 rounded-campo bg-fundo px-3.5 py-3">
            <dt className="text-[13px] font-semibold text-texto-secundario">{rotulo}</dt>
            <dd className="text-lg font-extrabold tracking-tight text-texto">{valor}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2.5" aria-labelledby="videos-do-produto">
        <h3 id="videos-do-produto" className="text-sm font-bold text-texto">
          Vídeos que promoveram o produto
        </h3>
        {p.videos.length === 0 ? (
          <p className="text-sm text-texto-secundario">
            Nenhuma venda deste produto veio de vídeo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.videos.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/videos/${v.id}`}
                  className="flex items-center gap-3 rounded-campo border border-borda p-2.5 no-underline hover:bg-fundo"
                >
                  <Miniatura url={v.coverUrl} rotulo="Capa do vídeo" className="h-14 w-10" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-texto">{v.title}</span>
                    <span className="text-[13px] text-texto-secundario">
                      {formatData(v.postedAt)}
                      {v.views !== null ? ` · ${formatInteiro(v.views)} views` : ''}
                    </span>
                  </span>
                  {v.gmv !== null ? (
                    <span className="text-sm font-bold tabular-nums text-texto">
                      {formatMoeda(v.gmv)}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to={`/planejamento?novo=1&produto=${p.productId}`}>
            <PenLine aria-hidden /> Criar roteiro
          </Link>
        </Button>
        <Button
          variant="secondary"
          onClick={regravar}
          disabled={criar.isPending || criar.isSuccess}
        >
          <RotateCcw aria-hidden />{' '}
          {criar.isSuccess ? 'Marcado para regravar' : 'Marcar para regravar'}
        </Button>
      </div>
      <Link to={`/vendas?produto=${p.productId}`} className="text-sm font-semibold">
        Ver as vendas deste produto
      </Link>
    </>
  );
}
