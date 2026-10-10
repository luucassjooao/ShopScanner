import { Link } from 'react-router-dom';
import { Check, FileUp, Link2, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { useAllVideos, useOrders, useStartTiktokConnection, useSummary } from '@/api/queries';
import type { Conta, OrderStatus, Summary } from '@/api/schemas';
import {
  BarrasHorizontais,
  BarrasPorDia,
  LinhaAcumulada,
  RoscaStatus,
} from '@/components/charts/Graficos';
import {
  Bloco,
  CabecalhoPagina,
  EstadoErro,
  Kpi,
  KpiBloqueado,
  Miniatura,
  PaginaApp,
  StatusBadge,
} from '@/components/dados';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatData,
  formatDataHora,
  formatHora,
  formatInteiro,
  formatMoeda,
  haQuanto,
} from '@/lib/format';
import { CHANNEL_LABEL } from '@/lib/labels';
import { dayKey, orderGmv } from '@/lib/metrics';
import { divRound, fromCents, toCents } from '@/lib/money';
import { EMAIL_CONTATO, PRAZO_SINCRONIZACAO } from '@/lib/textos';
import {
  conexaoExpirada,
  diaBR,
  diaMesBR,
  diasNoIntervalo,
  intervaloDoPreset,
  periodo,
  periodoAnterior,
  somarDias,
  useConta,
  useFiltros,
} from './filtros';

const ORDEM_STATUS: OrderStatus[] = [
  'TO_SETTLE',
  'SETTLED',
  'REFUNDED',
  'AWAITING_PAYMENT',
  'FROZEN',
];

export function Inicio() {
  const conta = useConta();
  if (!conta) return <PrimeiroAcesso />;
  if (conexaoExpirada(conta)) return <ConexaoExpirada conta={conta} />;
  if (!conta.hasSales) return <InicioSemVenda conta={conta} />;
  return <InicioComShop conta={conta} />;
}

function Cabecalho({ conta }: { conta: Conta }) {
  const f = useFiltros();
  return (
    <CabecalhoPagina
      titulo="Início"
      descricao={`${f.preset === 'personalizado' ? '' : `${f.rotuloPeriodo} · `}${diaBR(f.de)} a ${diaBR(f.ate)} · ${conta.username}`}
      acoes={
        conta.lastSyncedAt ? (
          <span className="text-[13px] text-texto-secundario">
            Atualizado em {formatData(conta.lastSyncedAt)}, às {formatHora(conta.lastSyncedAt)}
          </span>
        ) : null
      }
    />
  );
}

/**
 * Os gráficos são feitos de `byDay`, `byStatus` e `byChannel`, que vêm brutos do
 * contrato. O cartão do topo é o elegível. Como os dois números convivem na mesma
 * tela, cada gráfico diz de qual deles é feito.
 */
const NOTA_BRUTO =
  'Bruto: inclui aguardando pagamento, não elegível, reembolsado e retido. O GMV do topo mostra só o elegível.';

/** Depois disso, o painel está velho o bastante para a creator precisar saber. */
const DIAS_SEM_LEITURA = 5;

/**
 * Lembrete de trazer dado novo. Enquanto a conexão de pedidos não é liberada, isso
 * depende de a creator enviar o relatório — e ninguém lembra sozinho.
 */
function LembreteImport({ conta }: { conta: Conta }) {
  // Conta que nunca leu não tem "dias sem leitura": mesmo lembrete, com a copy que diz isso.
  const ultima = conta.lastSyncedAt;
  const dias = ultima ? Math.floor((Date.now() - Date.parse(ultima)) / 86_400_000) : 0;
  if (ultima && dias < DIAS_SEM_LEITURA) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-borda bg-status-a-liquidar-suave px-4 py-3.5">
      <TriangleAlert className="size-5 shrink-0 text-status-a-liquidar" aria-hidden />
      <p className="min-w-48 flex-1 text-[15px] leading-relaxed text-texto">
        {ultima ? (
          <>
            A última leitura foi {haQuanto(ultima)}. As vendas destes {dias} dias só entram no
            painel depois que você enviar o relatório.
          </>
        ) : (
          'Ainda sem leitura nesta conta. Envie o relatório para trazer as vendas para o painel.'
        )}
      </p>
      <Button size="sm" asChild>
        <Link to="/configuracoes?secao=import">
          <FileUp aria-hidden /> Enviar relatório
        </Link>
      </Button>
    </div>
  );
}

/** Os dias do período, para o gráfico não pular dia sem venda. */
function diasDe(de: string, ate: string) {
  return Array.from({ length: diasNoIntervalo(de, ate) }, (_, i) => somarDias(de, i));
}

function porDia(s: Summary | undefined, dias: string[], campo: 'gmv' | 'commission' = 'gmv') {
  const mapa = new Map(s?.byDay.map((d) => [d.date, d[campo]]));
  return dias.map((d) => mapa.get(d) ?? '0.00');
}

function acumular(valores: string[]) {
  let total = 0n;
  return valores.map((v) => fromCents((total += toCents(v))));
}

/** `+15,6%` / `−3,0%` entre dois valores de dinheiro. */
function variacao(atual: string, anterior: string) {
  const a = toCents(anterior);
  if (a === 0n) return null;
  const milesimos = Number(divRound((toCents(atual) - a) * 1000n, a));
  const texto = (Math.abs(milesimos) / 10).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${milesimos >= 0 ? '+' : '−'}${texto}%`;
}

function InicioComShop({ conta }: { conta: Conta }) {
  const f = useFiltros();
  const p = periodo(conta.id, f.de, f.ate);
  const ant = periodoAnterior(f.de, f.ate);
  const mes = intervaloDoPreset('mes');
  const resumo = useSummary(p);
  const resumoAnterior = useSummary(periodo(conta.id, ant.de, ant.ate));
  const resumoMes = useSummary(periodo(conta.id, mes.de, mes.ate));
  const recentes = useOrders(p, { pageSize: 5 });

  if (resumo.error) {
    return (
      <PaginaApp>
        <Cabecalho conta={conta} />
        <EstadoErro
          titulo="Não foi possível carregar o painel"
          error={resumo.error}
          onRetry={() => void resumo.refetch()}
        />
      </PaginaApp>
    );
  }

  const s = resumo.data;
  const dias = diasDe(f.de, f.ate);
  const diasAnt = diasDe(ant.de, ant.ate);
  const acumulado = acumular(porDia(s, dias));
  const acumuladoAnt = acumular(porDia(resumoAnterior.data, diasAnt));
  const meta = resumoMes.data?.goal?.gmv;
  // A barra mede o mesmo número que o cartão mostra: o GMV elegível.
  const pctMeta =
    meta && resumoMes.data && toCents(meta) > 0n
      ? Number(divRound(toCents(resumoMes.data.gmvEligible) * 100n, toCents(meta)))
      : null;
  const delta = s && resumoAnterior.data ? variacao(s.gmv, resumoAnterior.data.gmv) : null;

  return (
    <PaginaApp>
      <Cabecalho conta={conta} />
      <LembreteImport conta={conta} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5">
        {s ? (
          <>
            <Kpi
              rotulo="GMV"
              valor={formatMoeda(s.gmvEligible)}
              className="col-span-2 lg:col-span-1"
            >
              {/* O que ainda não conta como venda fica à parte, nunca somado ao topo. */}
              {toCents(s.gmvIneligible) > 0n ? (
                <span className="text-[13px] text-texto-secundario">
                  + {formatMoeda(s.gmvIneligible)} aguardando ou não elegível
                </span>
              ) : null}
              {pctMeta !== null && meta ? (
                <>
                  <span
                    className="h-2 overflow-hidden rounded-full bg-borda"
                    role="progressbar"
                    aria-valuenow={Math.min(pctMeta, 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progresso da meta do mês"
                  >
                    <span
                      className="block h-full rounded-full bg-grafico-1"
                      style={{ width: `${Math.min(pctMeta, 100)}%` }}
                    />
                  </span>
                  <span className="text-[13px] text-texto-secundario">
                    {pctMeta}% da meta de {formatMoeda(meta)} no mês
                  </span>
                </>
              ) : (
                <Link to="/configuracoes" className="text-[13px] font-semibold">
                  Definir a meta do mês
                </Link>
              )}
            </Kpi>
            <Kpi rotulo="Comissão estimada" valor={formatMoeda(s.commissionEstimated)}>
              <span className="hidden text-[13px] text-texto-secundario lg:block">
                Sujeita a devoluções até o fim do prazo
              </span>
            </Kpi>
            <Kpi rotulo="Itens vendidos" valor={formatInteiro(s.unitsSold)}>
              <span className="hidden text-[13px] text-texto-secundario lg:block">
                Somando todos os canais
              </span>
            </Kpi>
            <Kpi rotulo="A receber" valor={formatMoeda(s.commissionToReceive)}>
              <StatusBadge status="TO_SETTLE" className="self-start" />
            </Kpi>
            <Kpi rotulo="Comissão liquidada" valor={formatMoeda(s.commissionSettled)}>
              <StatusBadge status="SETTLED" className="self-start" />
            </Kpi>
            <Kpi
              rotulo="Ticket médio"
              valor={formatMoeda(s.avgTicket)}
              className="col-span-2 lg:col-span-1"
            >
              <span className="text-[13px] text-texto-secundario">
                Valor médio por pedido no período
              </span>
            </Kpi>
          </>
        ) : (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-card" />)
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Bloco
          titulo="GMV bruto por dia"
          extra={`${diaMesBR(f.de)} a ${diaMesBR(f.ate)}`}
          nota={NOTA_BRUTO}
        >
          {s ? (
            <BarrasPorDia
              nome="GMV"
              pontos={dias.map((d, i) => ({ rotulo: diaMesBR(d), valor: porDia(s, dias)[i]! }))}
            />
          ) : (
            <Skeleton className="h-[190px]" />
          )}
        </Bloco>
        <Bloco titulo="GMV bruto acumulado" nota={NOTA_BRUTO}>
          {s ? (
            <>
              <LinhaAcumulada
                pontos={dias.map((d, i) => ({
                  rotulo: diaMesBR(d),
                  atual: acumulado[i]!,
                  anterior: resumoAnterior.data ? (acumuladoAnt[i] ?? null) : null,
                }))}
              />
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-texto-secundario">
                <span className="text-xl font-extrabold text-texto">{formatMoeda(s.gmv)}</span>
                {delta && resumoAnterior.data ? (
                  <span>
                    {delta} sobre {formatMoeda(resumoAnterior.data.gmv)}
                  </span>
                ) : resumoAnterior.data ? (
                  <span>Sem vendas no período anterior</span>
                ) : null}
              </p>
            </>
          ) : (
            <Skeleton className="h-[190px]" />
          )}
        </Bloco>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Bloco
          titulo="GMV bruto por status"
          nota="Cada fatia é um status, então aqui o bruto é o ponto: é ele que mostra quanto ainda não virou venda."
        >
          {s ? (
            <RoscaStatus
              fatias={ORDEM_STATUS.map((st) => ({
                status: st,
                valor: s.byStatus.find((b) => b.status === st)?.gmv ?? '0.00',
              }))}
            />
          ) : (
            <Skeleton className="h-40" />
          )}
        </Bloco>
        <Bloco titulo="GMV bruto por canal" nota={NOTA_BRUTO}>
          {s ? (
            <BarrasHorizontais
              itens={[...s.byChannel]
                .sort((a, b) => Number(toCents(b.gmv) - toCents(a.gmv)))
                .map((c) => ({ rotulo: CHANNEL_LABEL[c.channel], valor: c.gmv }))}
            />
          ) : (
            <Skeleton className="h-40" />
          )}
        </Bloco>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Bloco
          titulo="Produtos que mais renderam"
          extra={
            <Link to="/produtos" className="font-semibold">
              Ver todos
            </Link>
          }
        >
          <ul className="flex flex-col divide-y divide-borda">
            {s?.topProducts.slice(0, 3).map((p) => (
              <li key={p.productId}>
                <Link
                  to={`/produtos?produto=${p.productId}`}
                  className="flex items-center gap-3 py-3 no-underline"
                >
                  <Miniatura url={null} rotulo="Imagem do produto" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold text-texto">{p.name}</span>
                    <span className="text-[13px] text-texto-secundario">{p.shopName}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="font-bold tabular-nums text-texto">{formatMoeda(p.gmv)}</span>
                    <span className="text-[13px] text-texto-secundario">
                      Comissão {formatMoeda(p.commission)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco
          titulo="Vendas recentes"
          extra={
            <Link to="/vendas" className="font-semibold">
              Ver todas as vendas
            </Link>
          }
        >
          <ul className="flex flex-col divide-y divide-borda">
            {recentes.data?.items.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/vendas?venda=${o.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 no-underline"
                >
                  <span className="w-24 text-[13px] text-texto-secundario">
                    {formatData(o.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-texto">
                    {o.skus[0]?.name}
                  </span>
                  <StatusBadge status={o.status} />
                  <span className="w-24 text-right font-bold tabular-nums text-texto">
                    {formatMoeda(orderGmv(o))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Bloco>
      </div>
    </PaginaApp>
  );
}

// --- conta sem nenhuma venda: só dados de vídeo, e o caminho é enviar o relatório ---

function InicioSemVenda({ conta }: { conta: Conta }) {
  const f = useFiltros();
  const videos = useAllVideos(periodo(conta.id, f.de, f.ate));
  const lista = videos.data ?? [];
  const soma = (k: 'views' | 'likes' | 'comments' | 'shares') =>
    lista.reduce((t, v) => t + v[k], 0);
  const views = soma('views');
  const interacoes = soma('likes') + soma('comments') + soma('shares');
  const engajamento = views
    ? ((interacoes / views) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    : '0';
  const dias = diasDe(f.de, f.ate);
  const viewsPorDia = new Map<string, number>();
  for (const v of lista) {
    const d = dayKey(v.postedAt);
    viewsPorDia.set(d, (viewsPorDia.get(d) ?? 0) + v.views);
  }
  let acumulado = 0;

  return (
    <PaginaApp>
      <Cabecalho conta={conta} />
      <LembreteImport conta={conta} />

      <section className="flex flex-col gap-4 rounded-card border border-borda bg-pessego/40 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-card bg-superficie">
            <FileUp className="size-6 text-apoio" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-texto">Ainda não há vendas nesta conta</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-texto-secundario">
              Envie o relatório affiliate_orders.xlsx do Centro de Afiliados para ver comissões e
              GMV. Por enquanto o painel mostra o desempenho dos seus vídeos.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/configuracoes?secao=import">
            <FileUp aria-hidden /> Enviar relatório
          </Link>
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {videos.data ? (
          <>
            <Kpi rotulo="Views" valor={formatInteiro(views)}>
              <span className="text-[13px] text-texto-secundario">
                Somando os {formatInteiro(lista.length)} vídeos do período
              </span>
            </Kpi>
            <Kpi rotulo="Curtidas" valor={formatInteiro(soma('likes'))} />
            <Kpi rotulo="Vídeos publicados" valor={formatInteiro(lista.length)} />
            <Kpi rotulo="Engajamento" valor={`${engajamento}%`}>
              <span className="text-[13px] text-texto-secundario">
                Curtidas, comentários e compartilhamentos
              </span>
            </Kpi>
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-card" />)
        )}
        <KpiBloqueado rotulo="GMV" />
        <KpiBloqueado rotulo="Comissão estimada" />
        <KpiBloqueado rotulo="Itens vendidos" />
        <KpiBloqueado rotulo="GPM" />
      </div>

      {videos.error ? (
        <EstadoErro
          titulo="Não foi possível carregar os vídeos"
          error={videos.error}
          onRetry={() => void videos.refetch()}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Bloco
          titulo="Views acumuladas no período"
          extra={`${diaMesBR(f.de)} a ${diaMesBR(f.ate)}`}
        >
          <p className="text-[13px] text-texto-secundario">
            Views de cada vídeo somadas no dia em que ele foi publicado.
          </p>
          <BarrasPorDia
            nome="Views acumuladas"
            formatar={(v) => formatInteiro(Number(v))}
            pontos={dias.map((d) => ({
              rotulo: diaMesBR(d),
              valor: String((acumulado += viewsPorDia.get(d) ?? 0)),
            }))}
          />
        </Bloco>
        <Bloco
          titulo="Vídeos com mais views"
          extra={
            <Link to="/videos?ordem=views" className="font-semibold">
              Ver todos
            </Link>
          }
        >
          <ul className="flex flex-col divide-y divide-borda">
            {[...lista]
              .sort((a, b) => b.views - a.views)
              .slice(0, 5)
              .map((v) => (
                <li key={v.id}>
                  <Link
                    to={`/videos/${v.id}`}
                    className="flex items-center gap-3 py-3 no-underline"
                  >
                    <Miniatura url={v.coverUrl} rotulo="Capa do vídeo" className="h-12 w-9" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold text-texto">
                        {v.title}
                      </span>
                      <span className="text-[13px] text-texto-secundario">
                        {formatData(v.postedAt)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end text-[13px] text-texto-secundario">
                      <span className="text-[15px] font-bold tabular-nums text-texto">
                        {formatInteiro(v.views)}
                      </span>
                      {formatInteiro(v.likes)} curtidas
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Bloco>
      </div>
    </PaginaApp>
  );
}

// --- estados sem dados ---

function PrimeiroAcesso() {
  const conectar = useStartTiktokConnection();
  const passos = [
    { titulo: 'Conta criada', texto: 'Seu acesso ao ShopScanner está pronto.', feito: true },
    {
      titulo: 'Conectar o TikTok',
      texto: 'É a autorização de leitura que traz os seus vídeos e comissões.',
      feito: false,
    },
    {
      titulo: 'Primeira sincronização',
      texto: 'O painel se preenche sozinho quando a primeira leitura terminar.',
      feito: false,
    },
  ];
  return (
    <PaginaApp>
      <CabecalhoPagina titulo="Início" descricao="Últimos 30 dias" />
      <section className="flex flex-col items-center gap-5 rounded-card border border-borda bg-superficie px-6 py-10 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-pessego">
          <Sparkles className="size-7 text-apoio" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-[22px] font-extrabold tracking-tight text-texto">
            Ainda não há dados por aqui
          </h2>
          <p className="max-w-[480px] text-[15px] leading-relaxed text-texto-secundario">
            Seu painel começa a encher assim que o TikTok estiver conectado. A primeira leitura
            costuma levar até {PRAZO_SINCRONIZACAO}.
          </p>
        </div>
        <ol className="flex w-full max-w-md flex-col gap-3 text-left">
          {passos.map((p, i) => (
            <li key={p.titulo} className="flex gap-3">
              <span
                className={
                  p.feito
                    ? 'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-status-liquidado text-white'
                    : 'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-pessego text-sm font-extrabold text-texto'
                }
              >
                {p.feito ? <Check className="size-4" aria-label="Feito" /> : i + 1}
              </span>
              <span className="flex flex-col">
                <span className="font-bold text-texto">{p.titulo}</span>
                <span className="text-sm text-texto-secundario">{p.texto}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            disabled={conectar.isPending}
            onClick={() =>
              conectar.mutate('VIDEOS', {
                onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
              })
            }
          >
            <Link2 aria-hidden /> Conectar o TikTok
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/inicio-rapido">Ver o início rápido</Link>
          </Button>
        </div>
      </section>
    </PaginaApp>
  );
}

function ConexaoExpirada({ conta }: { conta: Conta }) {
  const conectar = useStartTiktokConnection();
  return (
    <PaginaApp>
      <CabecalhoPagina titulo="Início" descricao={`Últimos 30 dias · ${conta.username}`} />
      <section className="flex flex-col items-center gap-3.5 rounded-card border border-borda bg-superficie px-6 py-10 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-status-reembolsado-suave">
          <Link2 className="size-7 text-status-reembolsado" aria-hidden />
        </span>
        <h2 className="text-[22px] font-extrabold tracking-tight text-texto">
          A conexão com o TikTok expirou
        </h2>
        <p className="max-w-[480px] text-[15px] leading-relaxed text-texto-secundario">
          A autorização de leitura vale por um período e a sua venceu em{' '}
          {formatData(conta.expiresAt!)}. Reconecte para o painel voltar a atualizar. Os dados já
          lidos continuam aqui.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1.5">
          <Button
            disabled={conectar.isPending}
            onClick={() =>
              conectar.mutate('VIDEOS', {
                onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
              })
            }
          >
            <RefreshCw aria-hidden /> Reconectar o TikTok
          </Button>
          <Button variant="secondary" asChild>
            <a href={`mailto:${EMAIL_CONTATO}`}>Falar com o suporte</a>
          </Button>
        </div>
        {conta.lastSyncedAt ? (
          <p className="text-[13px] text-texto-secundario">
            Última leitura em {formatDataHora(conta.lastSyncedAt)}
          </p>
        ) : null}
      </section>
    </PaginaApp>
  );
}
