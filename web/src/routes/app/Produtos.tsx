import { Link } from 'react-router-dom';
import { ExternalLink, ImageOff } from 'lucide-react';
import { useProduct, useProducts, type ProductsFiltro } from '@/api/queries';
import {
  CabecalhoPagina,
  Campo,
  EstadoConsulta,
  FiltroPeriodo,
  FiltroSelect,
  LinhaFiltros,
  Paginacao,
  ShopDesconectado,
} from '@/components/dados';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatData, formatInteiro, formatMoeda, formatTaxa } from '@/lib/format';
import { CHANNEL_LABEL } from '@/lib/labels';
import { periodo, useConta, useFiltros } from './filtros';

// O contrato de /products não recebe pageSize; o MSW (e o backend) usam 20.
const PAGE_SIZE = 20;

const ORDENS: { valor: NonNullable<ProductsFiltro['sort']>; rotulo: string }[] = [
  { valor: 'gmv', rotulo: 'Maior GMV' },
  { valor: 'commission', rotulo: 'Maior comissão' },
  { valor: 'units', rotulo: 'Mais itens vendidos' },
];

export function Produtos() {
  const conta = useConta();
  const f = useFiltros();
  const sort = ORDENS.find((o) => o.valor === f.get('ordem'))?.valor ?? 'gmv';
  const produtoId = f.get('produto');

  const query = useProducts(periodo(conta?.shopConnected ? conta.id : '', f.de, f.ate), {
    sort,
    page: f.pagina,
  });

  if (!conta?.shopConnected) {
    return (
      <Pagina>
        <ShopDesconectado oQue="os seus produtos" />
      </Pagina>
    );
  }

  const itens = query.data?.items ?? [];

  return (
    <Pagina>
      <LinhaFiltros>
        <FiltroPeriodo de={f.de} ate={f.ate} onChange={f.set} />
        <FiltroSelect
          rotulo="Ordenar por"
          valor={sort}
          opcoes={ORDENS}
          onChange={(v) => f.set({ ordem: v })}
          semTodos
        />
      </LinhaFiltros>

      <EstadoConsulta
        isPending={query.isPending}
        error={query.error}
        vazio={itens.length === 0}
        mensagemVazio="Nenhum produto vendido no período."
        onRetry={() => void query.refetch()}
      />

      {itens.length > 0 ? (
        <Card className="p-2" aria-busy={query.isFetching}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Reembolsos</TableHead>
                <TableHead>Canal principal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((p) => (
                <TableRow key={p.productId}>
                  <TableCell className="min-w-64">
                    <div className="flex items-center gap-3">
                      <Miniatura url={p.imageUrl} />
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="text-left font-semibold text-acao underline-offset-4 hover:underline"
                          onClick={() => f.set({ produto: p.productId, pagina: String(f.pagina) })}
                        >
                          {p.name}
                        </button>
                        <span className="text-legenda text-texto-secundario">
                          {p.shopName} · taxa {formatTaxa(p.commissionRate)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatMoeda(p.gmv)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatMoeda(p.commission)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInteiro(p.units)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInteiro(p.refundedUnits)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.topChannel ? CHANNEL_LABEL[p.topChannel] : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <Paginacao
        pagina={f.pagina}
        total={query.data?.total ?? 0}
        pageSize={PAGE_SIZE}
        onChange={(p) => f.set({ pagina: String(p) })}
      />

      <Sheet
        open={!!produtoId}
        onOpenChange={(aberto) => !aberto && f.set({ produto: null, pagina: String(f.pagina) })}
      >
        <SheetContent side="right" className="overflow-y-auto">
          {produtoId ? <DetalheProduto id={produtoId} /> : null}
        </SheetContent>
      </Sheet>
    </Pagina>
  );
}

function Pagina({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <CabecalhoPagina
        titulo="Produtos"
        descricao="Quais produtos mais renderam no período e de onde vieram as vendas."
      />
      {children}
    </main>
  );
}

function Miniatura({ url, className = 'size-12' }: { url: string | null; className?: string }) {
  if (!url) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-campo bg-fundo text-texto-secundario`}
      >
        <ImageOff className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      // URL quebrada: some a imagem e fica o fundo.
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
      className={`${className} shrink-0 rounded-campo bg-fundo object-cover`}
    />
  );
}

function DetalheProduto({ id }: { id: string }) {
  const { data: p, isPending, error, refetch } = useProduct(id);

  if (!p) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Produto</SheetTitle>
          <SheetDescription className="sr-only">Detalhe do produto</SheetDescription>
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

  return (
    <>
      <SheetHeader>
        <SheetTitle>{p.name}</SheetTitle>
        <SheetDescription>{p.shopName}</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4">
        <Miniatura url={p.imageUrl} className="size-20" />
        <div className="flex flex-col gap-1">
          {p.detailUrl ? (
            <a
              href={p.detailUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-corpo-sm font-semibold text-acao underline-offset-4 hover:underline"
            >
              Ver na loja <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
          <Link
            to={`/vendas?produto=${p.productId}`}
            className="text-corpo-sm font-semibold text-acao underline-offset-4 hover:underline"
          >
            Ver as vendas deste produto
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Campo rotulo="GMV">{formatMoeda(p.gmv)}</Campo>
        <Campo rotulo="Comissão estimada">{formatMoeda(p.commission)}</Campo>
        <Campo rotulo="Taxa atual">{formatTaxa(p.commissionRate)}</Campo>
        <Campo rotulo="Pedidos">{formatInteiro(p.ordersCount)}</Campo>
        <Campo rotulo="Itens vendidos">{formatInteiro(p.units)}</Campo>
        <Campo rotulo="Itens reembolsados">{formatInteiro(p.refundedUnits)}</Campo>
        <Campo rotulo="Canal principal">{p.topChannel ? CHANNEL_LABEL[p.topChannel] : '—'}</Campo>
      </dl>

      <section className="flex flex-col gap-3" aria-labelledby="videos-do-produto">
        <h3 id="videos-do-produto" className="text-corpo-sm font-bold text-texto">
          Vídeos que promoveram
        </h3>
        {p.videos.length === 0 ? (
          <p className="text-corpo-sm text-texto-secundario">
            Nenhuma venda deste produto veio de vídeo.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {p.videos.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/videos?video=${v.id}`}
                  className="flex items-center gap-3 rounded-campo p-1 hover:bg-fundo"
                >
                  <Miniatura url={v.coverUrl} className="h-16 w-12" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-texto">{v.title}</span>
                    <span className="text-legenda text-texto-secundario">
                      {formatData(v.postedAt)}
                      {v.views !== null ? ` · ${formatInteiro(v.views)} views` : ''}
                    </span>
                    <span className="text-legenda text-texto">
                      {v.gmv !== null ? `${formatMoeda(v.gmv)} de GMV` : null}
                      {v.units !== null ? ` · ${formatInteiro(v.units)} itens` : null}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
