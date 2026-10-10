import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, FileUp } from 'lucide-react';
import {
  buscarTodosPedidos,
  useOrder,
  useOrders,
  useProducts,
  useSummary,
  useVideo,
  type OrdersFiltro,
} from '@/api/queries';
import {
  channel,
  orderStatus,
  type Order,
  type OrderDetail,
  type OrderSku,
  type OrderStatus,
} from '@/api/schemas';
import {
  CabecalhoPagina,
  EstadoErro,
  EstadoVazio,
  Miniatura,
  PaginaApp,
  Procedencia,
  SemVendaNaConta,
  StatusBadge,
} from '@/components/dados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Busca, Carregando, ChipsFiltro, Rodape, campoFiltro } from '@/components/filtros';
import { baixarArquivo, vendasCsv } from '@/lib/csv';
import { formatData, formatHora, formatInteiro, formatMoeda, formatTaxa } from '@/lib/format';
import { CHANNEL_LABEL, STATUS_LABEL } from '@/lib/labels';
import { isShopAdsSale } from '@/lib/metrics';
import { divRound, fromCents, toCents } from '@/lib/money';
import { useDesktop } from '@/lib/useMedia';
import { cn } from '@/lib/utils';
import { hojeSP, intervaloDoPreset, periodo, somarDias, useConta, useFiltros } from './filtros';

const PAGE_SIZE = 20;

/** Uma linha da tabela é um item (SKU) do pedido, como no design. */
interface Linha {
  pedido: Order;
  sku: OrderSku;
}

/** Comissão do item: a real se já liquidou, senão a estimada. */
const comissaoItem = (o: Order, s: OrderSku) =>
  o.status === 'SETTLED' && s.commissionSettled !== null
    ? s.commissionSettled
    : s.commissionEstimated;

export function Vendas() {
  const conta = useConta();
  const f = useFiltros();
  const status = orderStatus.safeParse(f.get('status')).data;
  const canal = channel.safeParse(f.get('canal')).data;
  const produto = f.get('produto');
  const busca = f.get('q');
  const vendaId = f.get('venda');
  const desktop = useDesktop();

  // A consulta sempre acontece: o que decide a tela é a resposta, não o estado da conexão.
  const p = periodo(conta?.id ?? '', f.de, f.ate);
  const filtro: OrdersFiltro = {
    status,
    channel: canal,
    productId: produto ?? undefined,
    q: busca ?? undefined,
  };
  const query = useOrders(p, { ...filtro, page: f.pagina, pageSize: PAGE_SIZE });
  const resumo = useSummary(p);
  const produtos = useProducts(p);
  const [exportando, setExportando] = useState(false);

  if (!conta) {
    return (
      <PaginaApp>
        <CabecalhoPagina titulo="Vendas" />
        <EstadoVazio
          titulo="Nenhuma conta do TikTok conectada"
          texto="Conecte a sua conta em Configurações para ver as suas vendas."
          acoes={
            <Button variant="secondary" asChild>
              <Link to="/configuracoes">Abrir Configurações</Link>
            </Button>
          }
        />
      </PaginaApp>
    );
  }
  if (!conta.hasSales) {
    return (
      <PaginaApp>
        <CabecalhoPagina titulo="Vendas" />
        <SemVendaNaConta oQue="as suas vendas" />
      </PaginaApp>
    );
  }

  const linhas: Linha[] = (query.data?.items ?? []).flatMap((pedido) =>
    pedido.skus.map((sku) => ({ pedido, sku })),
  );
  const nomeProduto = produtos.data?.items.find((x) => x.productId === produto)?.name;
  const chips = [
    {
      nome: 'período',
      rotulo: f.rotuloPeriodo,
      remover: f.preset === '30' ? undefined : () => f.set(intervaloDoPreset('30')),
    },
    ...(status
      ? [
          {
            nome: 'status',
            rotulo: `Status: ${STATUS_LABEL[status]}`,
            remover: () => f.set({ status: null }),
          },
        ]
      : []),
    ...(canal
      ? [
          {
            nome: 'canal',
            rotulo: `Canal: ${CHANNEL_LABEL[canal]}`,
            remover: () => f.set({ canal: null }),
          },
        ]
      : []),
    ...(produto
      ? [
          {
            nome: 'produto',
            rotulo: `Produto: ${nomeProduto ?? 'selecionado'}`,
            remover: () => f.set({ produto: null }),
          },
        ]
      : []),
    ...(busca
      ? [{ nome: 'busca', rotulo: `Busca: ${busca}`, remover: () => f.set({ q: null }) }]
      : []),
  ];
  const temFiltro = !!(status || canal || produto || busca);
  const limpar = () => f.set({ status: null, canal: null, produto: null, q: null });
  const abrir = (l: Linha) =>
    f.set({ venda: l.pedido.id, item: l.sku.id, pagina: String(f.pagina) });

  async function exportar() {
    setExportando(true);
    try {
      const todos = await buscarTodosPedidos(p, filtro);
      baixarArquivo(vendasCsv(todos), `vendas-${f.de}-a-${f.ate}.csv`);
    } finally {
      setExportando(false);
    }
  }

  const descricao = query.isPending
    ? `Buscando os itens de ${f.rotuloPeriodo.toLowerCase()}…`
    : temFiltro
      ? `${formatInteiro(query.data?.total ?? 0)} pedidos com os filtros ativos`
      : resumo.data
        ? `${formatInteiro(resumo.data.unitsSold)} itens · ${formatMoeda(resumo.data.gmv)} em GMV · ${formatMoeda(resumo.data.commissionEstimated)} em comissão estimada`
        : undefined;

  return (
    <PaginaApp>
      <CabecalhoPagina
        titulo="Vendas"
        descricao={descricao}
        acoes={
          <>
            {/* Atalho para a entrada por arquivo: é daqui que a creator sente a falta. */}
            <Button variant="secondary" size="sm" asChild>
              <Link to="/configuracoes?secao=import">
                <FileUp aria-hidden /> Enviar relatório
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportar}
              disabled={exportando || !linhas.length}
            >
              <Download aria-hidden /> {exportando ? 'Exportando…' : 'Exportar CSV'}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-3 lg:p-4">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <select
            aria-label="Status"
            className={campoFiltro}
            value={status ?? ''}
            onChange={(e) => f.set({ status: e.target.value || null })}
          >
            <option value="">Todos os status</option>
            {orderStatus.options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Canal"
            className={campoFiltro}
            value={canal ?? ''}
            onChange={(e) => f.set({ canal: e.target.value || null })}
          >
            <option value="">Todos os canais</option>
            {channel.options.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            aria-label="Produto"
            className={cn(campoFiltro, 'max-w-60')}
            value={produto ?? ''}
            onChange={(e) => f.set({ produto: e.target.value || null })}
          >
            <option value="">Todos os produtos</option>
            {produto && !nomeProduto ? <option value={produto}>Produto selecionado</option> : null}
            {produtos.data?.items.map((x) => (
              <option key={x.productId} value={x.productId}>
                {x.name}
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
        <ChipsFiltro chips={chips} onLimpar={temFiltro ? limpar : undefined} />
      </div>

      {query.isPending ? (
        <Carregando rotulo="Carregando as suas vendas…" />
      ) : query.error ? (
        <EstadoErro
          titulo="Não foi possível carregar as vendas"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : linhas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma venda neste período"
          texto="Nenhum item combina com os filtros ativos. Tente ampliar o período ou remover algum filtro."
          acoes={
            <>
              {temFiltro ? <Button onClick={limpar}>Limpar filtros</Button> : null}
              <Button
                variant="secondary"
                onClick={() => f.set({ de: somarDias(hojeSP(), -89), ate: hojeSP() })}
              >
                Ampliar para 90 dias
              </Button>
            </>
          }
        />
      ) : (
        <>
          <TabelaVendas linhas={linhas} onAbrir={abrir} />
          <ListaVendas linhas={linhas} onAbrir={abrir} />
          <Rodape
            itens={linhas.length}
            total={query.data?.total ?? 0}
            pageSize={PAGE_SIZE}
            pagina={f.pagina}
            onPagina={(n) => f.set({ pagina: String(n) })}
          />
        </>
      )}

      <Sheet
        open={!!vendaId}
        onOpenChange={(aberto) =>
          !aberto && f.set({ venda: null, item: null, pagina: String(f.pagina) })
        }
      >
        <SheetContent
          side={desktop ? 'right' : 'bottom'}
          className={cn('overflow-y-auto', desktop ? 'sm:max-w-[448px]' : 'max-h-[680px]')}
        >
          {vendaId ? <DetalheVenda id={vendaId} itemId={f.get('item')} /> : null}
        </SheetContent>
      </Sheet>
    </PaginaApp>
  );
}

// --- lista ---

const th = 'h-11 px-3 text-left text-xs font-bold uppercase tracking-wide text-texto-secundario';
const td = 'px-3 py-3 align-middle';

function TabelaVendas({ linhas, onAbrir }: { linhas: Linha[]; onAbrir: (l: Linha) => void }) {
  return (
    <div className="relative hidden overflow-x-auto rounded-card border border-borda bg-superficie md:block">
      <table className="w-full text-sm">
        <thead className="border-b border-borda">
          <tr>
            <th className={th}>Data</th>
            <th className={th}>Produto</th>
            <th className={th}>Loja</th>
            <th className={th}>Canal</th>
            <th className={th}>Status</th>
            <th className={cn(th, 'text-right')}>Qtd</th>
            <th className={cn(th, 'text-right')}>GMV</th>
            <th className={cn(th, 'text-right')}>Comissão</th>
            <th className={cn(th, 'text-right')}>Taxa</th>
            <th className={th}>
              <span className="sr-only">Detalhe</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={`${l.pedido.id}-${l.sku.id}`}
              className="border-b border-borda last:border-0 hover:bg-fundo"
            >
              <td className={cn(td, 'whitespace-nowrap text-texto-secundario')}>
                {formatData(l.pedido.createdAt)}
              </td>
              <td className={cn(td, 'min-w-56')}>
                <span className="flex items-center gap-3">
                  <Miniatura url={null} rotulo="Imagem do produto" className="size-9" />
                  <button
                    type="button"
                    onClick={() => onAbrir(l)}
                    className="text-left font-semibold text-texto hover:text-acao"
                  >
                    {l.sku.name}
                  </button>
                </span>
              </td>
              <td className={cn(td, 'whitespace-nowrap text-texto-secundario')}>
                {l.sku.shopName}
              </td>
              <td className={cn(td, 'whitespace-nowrap')}>{CHANNEL_LABEL[l.sku.channel]}</td>
              <td className={td}>
                <StatusBadge status={l.pedido.status} />
              </td>
              <td className={cn(td, 'text-right tabular-nums')}>{formatInteiro(l.sku.quantity)}</td>
              <td className={cn(td, 'whitespace-nowrap text-right font-semibold tabular-nums')}>
                {formatMoeda(l.sku.gmv)}
              </td>
              <td className={cn(td, 'whitespace-nowrap text-right tabular-nums')}>
                {formatMoeda(comissaoItem(l.pedido, l.sku))}
              </td>
              <td className={cn(td, 'text-right tabular-nums text-texto-secundario')}>
                {formatTaxa(l.sku.commissionRate, { casas: 1 })}
              </td>
              <td className={td}>
                <button
                  type="button"
                  onClick={() => onAbrir(l)}
                  aria-label={`Abrir detalhe da venda de ${formatData(l.pedido.createdAt)}`}
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

function ListaVendas({ linhas, onAbrir }: { linhas: Linha[]; onAbrir: (l: Linha) => void }) {
  return (
    <ul className="flex flex-col gap-2.5 md:hidden">
      {linhas.map((l) => (
        <li key={`${l.pedido.id}-${l.sku.id}`}>
          <button
            type="button"
            onClick={() => onAbrir(l)}
            className="flex w-full items-start gap-3 rounded-card border border-borda bg-superficie p-3 text-left"
          >
            <Miniatura url={null} rotulo="Imagem do produto" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-bold leading-snug text-texto">{l.sku.name}</span>
              <span className="text-xs text-texto-secundario">
                {formatData(l.pedido.createdAt)} · {CHANNEL_LABEL[l.sku.channel]} ·{' '}
                {formatInteiro(l.sku.quantity)} un
              </span>
              <StatusBadge status={l.pedido.status} className="self-start" />
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="font-bold tabular-nums text-texto">{formatMoeda(l.sku.gmv)}</span>
              <span className="text-xs text-texto-secundario">
                {formatMoeda(comissaoItem(l.pedido, l.sku))}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// --- detalhe ---

function DetalheVenda({ id, itemId }: { id: string; itemId: string | null }) {
  const { data: o, isPending, error, refetch } = useOrder(id);
  const f = useFiltros();

  if (!o) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Detalhe da venda</SheetTitle>
          <SheetDescription className="sr-only">Detalhe da venda</SheetDescription>
        </SheetHeader>
        {isPending ? (
          <Skeleton className="h-64" />
        ) : (
          <EstadoErro
            titulo="Não foi possível abrir a venda"
            error={error}
            onRetry={() => void refetch()}
          />
        )}
      </>
    );
  }

  const sku = o.skus.find((s) => s.id === itemId) ?? o.skus[0]!;
  const outros = o.skus.filter((s) => s !== sku);
  const unidades = (n: number) => `${formatInteiro(n)} ${n === 1 ? 'unidade' : 'unidades'}`;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-lg font-bold">Detalhe da venda</SheetTitle>
        <SheetDescription className="sr-only">
          Composição da comissão e origem da venda
        </SheetDescription>
      </SheetHeader>

      <div className="flex items-start gap-3">
        <Miniatura url={null} rotulo="Imagem do produto" className="size-14" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-bold text-texto">{sku.name}</span>
          <span className="text-[13px] text-texto-secundario">
            {sku.shopName} · {unidades(sku.quantity)} · {CHANNEL_LABEL[sku.channel]}
          </span>
          <span className="break-all text-[13px] text-texto-secundario">
            Pedido {o.id} · {formatData(o.createdAt)}, às {formatHora(o.createdAt)}
          </span>
          <StatusBadge status={o.status} className="mt-1 self-start" />
          <Procedencia source={o.source} sourceAt={o.sourceAt} className="mt-0.5" />
        </div>
      </div>

      {outros.length ? (
        <p className="text-[13px] text-texto-secundario">
          Este pedido tem mais {outros.length === 1 ? '1 item' : `${outros.length} itens`}:{' '}
          {outros.map((s, i) => (
            <span key={s.id}>
              {i ? ', ' : ''}
              <button
                type="button"
                className="font-semibold text-acao hover:underline"
                onClick={() => f.set({ item: s.id, pagina: String(f.pagina) })}
              >
                {s.name}
              </button>
            </span>
          ))}
        </p>
      ) : null}

      <LinhaDoTempo pedido={o} />
      <BaseECalculo pedido={o} sku={sku} />
      <OrigemVenda sku={sku} />

      <div className="flex items-center justify-between rounded-campo bg-fundo px-3.5 py-3 text-sm">
        <span className="text-texto-secundario">Quantidade reembolsada</span>
        <span className="font-bold text-texto">
          {formatInteiro(sku.refundedQuantity)} de {unidades(sku.quantity)}
        </span>
      </div>
      {sku.returnedQuantity ? (
        <div className="flex items-center justify-between rounded-campo bg-fundo px-3.5 py-3 text-sm">
          <span className="text-texto-secundario">Quantidade devolvida</span>
          <span className="font-bold text-texto">{formatInteiro(sku.returnedQuantity)}</span>
        </div>
      ) : null}

      {o.status !== 'SETTLED' ? (
        <p className="text-[13px] leading-relaxed text-texto-secundario">
          A comissão só é confirmada depois que o prazo de devolução encerra. Até lá, o valor pode
          mudar.
        </p>
      ) : null}
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm font-bold text-texto">{titulo}</h3>
      {children}
    </section>
  );
}

function LinhaDoTempo({ pedido: o }: { pedido: OrderDetail }) {
  const passos: { rotulo: string; at: string; status?: OrderStatus }[] = [
    ...o.statusHistory.map((h, i) => ({
      rotulo: i === 0 ? 'Pedido criado' : STATUS_LABEL[h.status],
      at: h.at,
      status: h.status,
    })),
    ...(o.deliveredAt ? [{ rotulo: 'Pedido entregue', at: o.deliveredAt }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Secao titulo="Linha do tempo do status">
      <ol className="flex flex-col gap-3 border-l-2 border-borda pl-4">
        {passos.map((p, i) => {
          const atual = i === passos.length - 1;
          return (
            <li key={`${p.rotulo}-${p.at}`} className="relative flex flex-col">
              <span
                className={cn(
                  'absolute -left-[23px] top-1 size-3 rounded-full border-2 border-superficie',
                  atual ? 'bg-acao' : 'bg-borda',
                )}
                aria-hidden
              />
              <span className={cn('text-sm text-texto', atual ? 'font-bold' : 'font-semibold')}>
                {p.rotulo}
              </span>
              <span className="text-[13px] text-texto-secundario">
                {formatData(p.at)}
                {atual ? ' · etapa atual' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </Secao>
  );
}

/** Valor de uma parte da taxa sobre a base. Estimativa: o total oficial é o da plataforma. */
const parte = (base: string, taxa: number) =>
  fromCents(divRound(toCents(base) * BigInt(taxa), 10_000n));

function BaseECalculo({ pedido: o, sku }: { pedido: Order; sku: OrderSku }) {
  const base = sku.commissionBaseActual ?? sku.gmv;
  const partes = [
    { rotulo: 'Comissão padrão', taxa: sku.rates.standard, valor: parte(base, sku.rates.standard) },
    { rotulo: 'Anúncio da loja', taxa: sku.rates.shopAds, valor: sku.shopAdsCommissionEstimated },
    { rotulo: 'Bônus de campanha', taxa: sku.rates.bonus, valor: parte(base, sku.rates.bonus) },
    { rotulo: 'Reward', taxa: sku.rates.reward, valor: parte(base, sku.rates.reward) },
  ].filter((p, i) => i === 0 || p.taxa > 0);
  const linha = 'flex items-center justify-between gap-3 py-2 text-sm';

  return (
    <>
      <Secao titulo="Base de cálculo">
        <div className="divide-y divide-borda rounded-campo border border-borda px-3.5">
          <div className={linha}>
            <span className="text-texto-secundario">GMV do item</span>
            <span className="font-semibold tabular-nums text-texto">{formatMoeda(sku.gmv)}</span>
          </div>
          <div className={linha}>
            <span className="font-semibold text-texto">
              Base da comissão{sku.commissionBaseActual !== null ? ' (sem devoluções)' : ''}
            </span>
            <span className="font-bold tabular-nums text-texto">{formatMoeda(base)}</span>
          </div>
        </div>
      </Secao>

      <Secao titulo="Composição da taxa">
        <div className="divide-y divide-borda rounded-campo border border-borda px-3.5">
          {partes.map((p) => (
            <div key={p.rotulo} className={linha}>
              <span className="flex-1 text-texto-secundario">{p.rotulo}</span>
              <span className="w-14 text-right tabular-nums text-texto-secundario">
                {formatTaxa(p.taxa, { casas: 1 })}
              </span>
              <span className="w-24 text-right tabular-nums text-texto">
                {formatMoeda(p.valor)}
              </span>
            </div>
          ))}
          <div className={linha}>
            <span className="flex-1 font-bold text-texto">Comissão estimada</span>
            <span className="w-14 text-right font-bold tabular-nums text-texto">
              {formatTaxa(sku.commissionRate, { casas: 1 })}
            </span>
            <span className="w-24 text-right font-bold tabular-nums text-texto">
              {formatMoeda(sku.commissionEstimated)}
            </span>
          </div>
          {sku.commissionSettled !== null ? (
            <div className={linha}>
              <span className="flex-1 font-bold text-status-liquidado">Comissão liquidada</span>
              <span className="w-24 text-right font-bold tabular-nums text-status-liquidado">
                {formatMoeda(sku.commissionSettled)}
              </span>
            </div>
          ) : o.status === 'REFUNDED' || o.status === 'FROZEN' ? (
            <div className={linha}>
              <span className="flex-1 text-texto-secundario">
                Não será paga enquanto estiver {STATUS_LABEL[o.status].toLowerCase()}
              </span>
            </div>
          ) : null}
        </div>
        {isShopAdsSale(sku) ? (
          <Badge variant="marca" className="self-start">
            Venda por anúncio da loja
          </Badge>
        ) : null}
        <p className="text-xs text-texto-secundario">
          As partes são calculadas sobre a base; o total é o informado pela plataforma.
        </p>
      </Secao>
    </>
  );
}

/**
 * Venda de vídeo aponta para o vídeo pelo `contentId`. Ainda não está confirmado que é o
 * mesmo id da Display API (CLAUDE.md); se não for, o vídeo só não é encontrado.
 */
function OrigemVenda({ sku }: { sku: OrderSku }) {
  const ehVideo = sku.channel === 'VIDEO' && !!sku.contentId;
  const video = useVideo(ehVideo ? sku.contentId! : '');
  return (
    <Secao titulo="Origem da venda">
      <div className="flex items-center gap-3 rounded-campo border border-borda p-3">
        {ehVideo && video.data ? (
          <>
            <Miniatura url={video.data.coverUrl} rotulo="Capa do vídeo" className="h-14 w-10" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-texto">{video.data.title}</span>
              <span className="text-[13px] text-texto-secundario">
                Publicado em {formatData(video.data.postedAt)}
              </span>
            </span>
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/videos/${video.data.id}`}>Abrir</Link>
            </Button>
          </>
        ) : (
          <span className="text-sm text-texto">
            {CHANNEL_LABEL[sku.channel]}
            {ehVideo && video.isPending ? ' · carregando o vídeo…' : ''}
            {ehVideo && video.error ? ' · vídeo não encontrado' : ''}
          </span>
        )}
      </div>
    </Secao>
  );
}
