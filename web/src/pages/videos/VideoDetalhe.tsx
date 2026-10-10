import { Link, useParams, useSearchParams } from 'react-router';
import {
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Share2,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { useVideo } from '@/api/queries';
import type { VideoDetail } from '@/api/schemas';
import { CurvaViews } from '@/components/charts/CurvaViews';
import { Bloco, EstadoErro, PaginaApp } from '@/components/dados';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatData, formatHora, formatInteiro, formatMoeda } from '@/lib/format';
import { Capa } from './Capa';
import { duracao, hashtagsDe } from './pecas';

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
            <SemVendaDoVideo />
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

/**
 * Vídeo sem venda ligada a ele (GMV nulo). Não é cadeado: a venda pode existir na conta e
 * simplesmente não apontar para este vídeo. Views e engajamento seguem aparecendo acima.
 */
function SemVendaDoVideo() {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-dashed border-borda bg-superficie/60 p-5">
      <h2 className="text-[17px] font-bold text-texto">Vendas e GPM</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-texto-secundario">
        Nenhuma venda ligada a este vídeo ainda. Quando um pedido trouxer este vídeo, o GMV, a
        comissão e o GPM aparecem aqui.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" asChild>
          <Link to="/vendas">Ver as vendas da conta</Link>
        </Button>
      </div>
    </section>
  );
}
