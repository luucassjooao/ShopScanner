import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useOrder, useOrders } from '@/api/queries';
import { channel, orderStatus, type Channel, type OrderSku, type OrderStatus } from '@/api/schemas';
import {
  CabecalhoPagina,
  Campo,
  EstadoConsulta,
  FiltroPeriodo,
  FiltroSelect,
  LinhaFiltros,
  Paginacao,
  ShopDesconectado,
  StatusBadge,
} from '@/components/dados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatDataHora, formatInteiro, formatMoeda, formatTaxa } from '@/lib/format';
import { CHANNEL_LABEL, STATUS_LABEL } from '@/lib/labels';
import { isShopAdsSale, orderCommission, orderGmv } from '@/lib/metrics';
import { periodo, useConta, useFiltros } from './filtros';

const PAGE_SIZE = 20;

export function Vendas() {
  const conta = useConta();
  const f = useFiltros();
  const status = orderStatus.safeParse(f.get('status')).data;
  const canal = channel.safeParse(f.get('canal')).data;
  const produto = f.get('produto');
  const vendaId = f.get('venda');

  const query = useOrders(periodo(conta?.shopConnected ? conta.id : '', f.de, f.ate), {
    status,
    channel: canal,
    productId: produto ?? undefined,
    page: f.pagina,
    pageSize: PAGE_SIZE,
  });

  if (!conta?.shopConnected) {
    return (
      <Pagina>
        <ShopDesconectado oQue="as suas vendas" />
      </Pagina>
    );
  }

  const itens = query.data?.items ?? [];

  return (
    <Pagina>
      <LinhaFiltros>
        <FiltroPeriodo de={f.de} ate={f.ate} onChange={f.set} />
        <FiltroSelect
          rotulo="Status"
          valor={status ?? null}
          opcoes={orderStatus.options.map((s) => ({ valor: s, rotulo: STATUS_LABEL[s] }))}
          onChange={(v) => f.set({ status: v })}
        />
        <FiltroSelect
          rotulo="Origem"
          valor={canal ?? null}
          opcoes={channel.options.map((c) => ({ valor: c, rotulo: CHANNEL_LABEL[c] }))}
          onChange={(v) => f.set({ canal: v })}
        />
        {produto ? (
          <Button variant="outline" size="sm" onClick={() => f.set({ produto: null })}>
            Só um produto <X aria-hidden />
            <span className="sr-only">remover filtro de produto</span>
          </Button>
        ) : null}
      </LinhaFiltros>

      <EstadoConsulta
        isPending={query.isPending}
        error={query.error}
        vazio={itens.length === 0}
        mensagemVazio="Nenhuma venda com esses filtros no período."
        onRetry={() => void query.refetch()}
      />

      {itens.length > 0 ? (
        <Card className="p-2" aria-busy={query.isFetching}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((o) => {
                const comissao = orderCommission(o);
                const [primeiro, ...resto] = o.skus;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap">
                      <button
                        type="button"
                        className="font-semibold text-acao underline-offset-4 hover:underline"
                        onClick={() => f.set({ venda: o.id, pagina: String(f.pagina) })}
                      >
                        {formatDataHora(o.createdAt)}
                      </button>
                    </TableCell>
                    <TableCell className="min-w-48">
                      {primeiro?.name}
                      {resto.length ? (
                        <span className="text-texto-secundario"> +{resto.length}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {[...new Set(o.skus.map((s) => CHANNEL_LABEL[s.channel]))].join(', ')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(orderGmv(o))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(comissao.valor)}
                      {comissao.real ? null : (
                        <span className="block text-legenda text-texto-secundario">estimada</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
        open={!!vendaId}
        onOpenChange={(aberto) => !aberto && f.set({ venda: null, pagina: String(f.pagina) })}
      >
        <SheetContent side="right" className="overflow-y-auto">
          {vendaId ? <DetalheVenda id={vendaId} /> : null}
        </SheetContent>
      </Sheet>
    </Pagina>
  );
}

function Pagina({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <CabecalhoPagina
        titulo="Vendas"
        descricao="Cada pedido que passou pelos seus links, vídeos e lives."
      />
      {children}
    </main>
  );
}

function DetalheVenda({ id }: { id: string }) {
  const { data: o, isPending, error, refetch } = useOrder(id);

  if (!o) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Venda</SheetTitle>
          <SheetDescription className="sr-only">Detalhe da venda</SheetDescription>
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
        <SheetTitle>Venda de {formatDataHora(o.createdAt)}</SheetTitle>
        <SheetDescription>Pedido {o.id}</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-2">
        <StatusBadge status={o.status} />
        {o.deliveredAt ? (
          <span className="text-legenda text-texto-secundario">
            Entregue em {formatDataHora(o.deliveredAt)}
          </span>
        ) : null}
      </div>

      <section aria-labelledby="linha-do-tempo" className="flex flex-col gap-2">
        <h3 id="linha-do-tempo" className="text-corpo-sm font-bold text-texto">
          Linha do tempo
        </h3>
        <ol className="flex flex-col gap-2 border-l-2 border-borda pl-4">
          {o.statusHistory.map((h) => (
            <li key={`${h.status}-${h.at}`} className="text-corpo-sm">
              <span className="font-semibold text-texto">{STATUS_LABEL[h.status]}</span>
              <span className="text-texto-secundario"> · {formatDataHora(h.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {o.skus.map((sku) => (
        <ItemVenda key={sku.id} sku={sku} status={o.status} />
      ))}
    </>
  );
}

function ItemVenda({ sku, status }: { sku: OrderSku; status: OrderStatus }) {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <p className="font-bold text-texto">{sku.name}</p>
        <p className="text-legenda text-texto-secundario">{sku.shopName}</p>
        {isShopAdsSale(sku) ? (
          <Badge variant="marca" className="self-start">
            Venda por anúncio da loja
          </Badge>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Campo rotulo="Quantidade">
          {formatInteiro(sku.quantity)} × {formatMoeda(sku.unitPrice)}
        </Campo>
        <Campo rotulo="GMV">{formatMoeda(sku.gmv)}</Campo>
        <Campo rotulo="Reembolsados">
          {formatInteiro(sku.refundedQuantity)} de {formatInteiro(sku.quantity)}
        </Campo>
        <Campo rotulo="Devolvidos">{formatInteiro(sku.returnedQuantity)}</Campo>
        <Campo rotulo="Origem da venda">
          <OrigemVenda channel={sku.channel} contentId={sku.contentId} />
        </Campo>
      </dl>

      <section className="flex flex-col gap-2" aria-label="Divisão da comissão">
        <h4 className="text-corpo-sm font-bold text-texto">Divisão da comissão</h4>
        <dl className="grid grid-cols-2 gap-3">
          <Campo rotulo="Taxa padrão">{formatTaxa(sku.rates.standard)}</Campo>
          <Campo rotulo="Anúncio da loja">{formatTaxa(sku.rates.shopAds)}</Campo>
          <Campo rotulo="Bônus">{formatTaxa(sku.rates.bonus)}</Campo>
          <Campo rotulo="Reward">{formatTaxa(sku.rates.reward)}</Campo>
          <Campo rotulo="Taxa total">{formatTaxa(sku.commissionRate)}</Campo>
          <Campo rotulo="Comissão estimada">{formatMoeda(sku.commissionEstimated)}</Campo>
          <Campo rotulo="Parte do anúncio da loja">
            {formatMoeda(sku.shopAdsCommissionEstimated)}
          </Campo>
          <Campo rotulo="Comissão liquidada">
            {sku.commissionSettled !== null ? (
              formatMoeda(sku.commissionSettled)
            ) : (
              <span className="font-normal text-texto-secundario">
                {status === 'REFUNDED' || status === 'FROZEN'
                  ? `Não será paga (${STATUS_LABEL[status].toLowerCase()})`
                  : 'Aparece quando liquidar'}
              </span>
            )}
          </Campo>
          {sku.commissionBaseActual !== null ? (
            <Campo rotulo="Base real (sem devoluções)">
              {formatMoeda(sku.commissionBaseActual)}
            </Campo>
          ) : null}
        </dl>
      </section>
    </Card>
  );
}

/**
 * Pedidos de vídeo linkam para o vídeo pelo `contentId`. Ainda não está confirmado que é o
 * mesmo id do vídeo (CLAUDE.md); se não for, o link só não encontra nada.
 */
function OrigemVenda({ channel: c, contentId }: { channel: Channel; contentId: string | null }) {
  if (c === 'VIDEO' && contentId) {
    return (
      <Link
        to={`/videos?video=${contentId}`}
        className="text-acao underline-offset-4 hover:underline"
      >
        {CHANNEL_LABEL[c]}
      </Link>
    );
  }
  return <>{CHANNEL_LABEL[c]}</>;
}
