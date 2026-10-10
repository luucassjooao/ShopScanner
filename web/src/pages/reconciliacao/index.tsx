import { Link } from 'react-router';
import { useReconciliation } from '@/api/queries';
import {
  CabecalhoPagina,
  EstadoErro,
  EstadoVazio,
  PaginaApp,
  Procedencia,
} from '@/components/dados';
import { Button } from '@/components/ui/button';
import { Carregando } from '@/components/filtros';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDataHora } from '@/lib/format';
import { periodo, useConta, useFiltros } from '@/lib/filtros';

/**
 * Divergências entre o arquivo e a API para o mesmo pedido. A API sempre prevalece;
 * nada é sobrescrito em silêncio (CLAUDE.md → "Fontes do dado").
 *
 * Fica vazia enquanto a Affiliate Creator API não for liberada no Brasil: com uma
 * fonte só, não há o que divergir.
 */
export function Reconciliacao() {
  const conta = useConta();
  const f = useFiltros();
  const p = periodo(conta?.id ?? '', f.de, f.ate);
  const linhas = useReconciliation(p);

  return (
    <PaginaApp className="max-w-[1100px]">
      <CabecalhoPagina
        titulo="Divergências"
        descricao="Onde o arquivo e a API discordaram sobre o mesmo pedido, e o que prevaleceu"
        acoes={
          <Button variant="secondary" asChild>
            <Link to="/configuracoes?secao=import">Enviar relatório</Link>
          </Button>
        }
      />

      {linhas.isPending ? <Carregando rotulo="Carregando divergências" /> : null}

      {linhas.error ? (
        <EstadoErro
          titulo="Não conseguimos carregar as divergências"
          error={linhas.error}
          onRetry={() => void linhas.refetch()}
        />
      ) : null}

      {linhas.data?.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma divergência"
          texto="Enquanto os pedidos vierem de uma fonte só, não há o que comparar. Quando a conexão de pedidos for liberada, o que o arquivo trouxe é reconferido pela API e as diferenças aparecem aqui."
        />
      ) : null}

      {linhas.data?.length ? (
        <div className="overflow-x-auto rounded-card border border-borda bg-superficie">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>No arquivo</TableHead>
                <TableHead>Na API</TableHead>
                <TableHead>Prevaleceu</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.data.map((l) => (
                <TableRow key={`${l.orderId}-${l.skuId}-${l.field}`}>
                  <TableCell>
                    <span className="flex flex-col">
                      <Link to={`/vendas?venda=${l.orderId}`} className="font-semibold">
                        {l.orderId}
                      </Link>
                      <span className="text-[13px] text-texto-secundario">item {l.skuId}</span>
                    </span>
                  </TableCell>
                  <TableCell>{l.field}</TableCell>
                  <TableCell className="text-texto-secundario">{l.fromFile ?? '—'}</TableCell>
                  <TableCell>{l.fromApi ?? '—'}</TableCell>
                  <TableCell>
                    <Procedencia source={l.resolvedWith} sourceAt={l.at} />
                  </TableCell>
                  <TableCell className="text-texto-secundario">{formatDataHora(l.at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </PaginaApp>
  );
}
