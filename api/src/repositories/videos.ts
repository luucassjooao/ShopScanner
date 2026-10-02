import { z } from 'zod';
import { many, sql } from '../lib/db.ts';
import type { Periodo } from './orders.ts';

const dinheiro = z.string();

const linhaVideo = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  posted_at: z.date(),
  duration: z.number().int(),
  cover_url: z.string().nullable(),
  share_url: z.string().nullable(),
  views: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
  shares: z.number().int(),
  gmv: dinheiro.nullable(),
  commission: dinheiro.nullable(),
  gpm: dinheiro.nullable(),
});

export type LinhaVideo = z.infer<typeof linhaVideo>;
export type OrdemVideos = 'postedAt' | 'views' | 'gmv' | 'gpm';

/**
 * Venda por vídeo depende da suposição isolada de que `content_id` do pedido é
 * o id do vídeo. Sem o TikTok Shop conectado, as três colunas saem **nulas** —
 * nunca zero, que a tela leria como "vendeu nada".
 */
function vendasPorVideo(p: Periodo, comShop: boolean) {
  if (!comShop)
    return sql`select null::text as video_id, null::numeric as gmv,
                                  null::numeric as commission where false`;
  return sql`select s.content_id as video_id,
                    sum(s.gmv) as gmv,
                    sum(s.commission_estimated) as commission
               from order_skus s
               join orders o on o.account_id = s.account_id and o.id = s.order_id
              where s.account_id = ${p.accountId} and s.channel = 'VIDEO'
                and s.content_id is not null
                and o.created_at between ${p.from} and ${p.to}
              group by s.content_id`;
}

function ordenar(ordem: OrdemVideos) {
  if (ordem === 'views') return sql`order by v.views desc, v.id`;
  if (ordem === 'gmv') return sql`order by coalesce(x.gmv, 0) desc, v.id`;
  if (ordem === 'gpm') return sql`order by coalesce(gpm, 0) desc, v.id`;
  return sql`order by v.posted_at desc, v.id`;
}

export async function contar(p: Periodo, hashtag?: string) {
  const [linha] = await many(
    z.object({ total: z.number().int() }),
    sql`select count(*)::int as total from videos v
         where v.account_id = ${p.accountId}
           and v.posted_at between ${p.from} and ${p.to}
           ${hashtag ? sql`and v.description ilike ${`%#${hashtag.replace(/^#/, '')}%`}` : sql``}`,
  );
  return linha!.total;
}

export function listar(
  p: Periodo,
  opcoes: {
    comShop: boolean;
    ordem: OrdemVideos;
    hashtag?: string;
    limite: number;
    offset: number;
  },
) {
  const filtroHashtag = opcoes.hashtag
    ? sql`and v.description ilike ${`%#${opcoes.hashtag.replace(/^#/, '')}%`}`
    : sql``;
  return many(
    linhaVideo,
    sql`with vendas as (${vendasPorVideo(p, opcoes.comShop)})
        select v.id, v.title, v.description, v.posted_at, v.duration, v.cover_url, v.share_url,
               v.views::int as views, v.likes::int as likes, v.comments::int as comments,
               v.shares::int as shares,
               x.gmv::numeric(18,2) as gmv,
               x.commission::numeric(18,2) as commission,
               -- GPM: GMV por mil views.
               case when x.gmv is not null and v.views > 0
                    then round(x.gmv * 1000 / v.views, 2) end as gpm
          from videos v
          left join vendas x on x.video_id = v.id
         where v.account_id = ${p.accountId}
           and v.posted_at between ${p.from} and ${p.to}
           ${filtroHashtag}
         ${ordenar(opcoes.ordem)}
         limit ${opcoes.limite} offset ${opcoes.offset}`,
  );
}

export async function buscarPorId(userId: string, id: string) {
  const [linha] = await many(
    z.object({ account_id: z.guid(), shop_connected: z.boolean() }).extend(linhaVideo.shape).omit({
      gmv: true,
      commission: true,
      gpm: true,
    }),
    sql`select v.account_id, v.id, v.title, v.description, v.posted_at, v.duration,
               v.cover_url, v.share_url, v.views::int as views, v.likes::int as likes,
               v.comments::int as comments, v.shares::int as shares,
               exists (select 1 from provider_connections s
                        where s.user_id = c.user_id and s.provider = c.provider
                          and s.kind = 'SHOP' and s.provider_user_id = c.provider_user_id
                          and s.revoked_at is null) as shop_connected
          from videos v
          join provider_connections c on c.id = v.account_id
         where v.id = ${id} and c.user_id = ${userId}
         limit 1`,
  );
  return linha ?? null;
}

/** Soma do vídeo sem recorte de período: o detalhe mostra a vida toda dele. */
export async function vendasDoVideo(accountId: string, videoId: string, views: number) {
  const [linha] = await many(
    z.object({
      gmv: dinheiro,
      commission: dinheiro,
      units: z.number().int(),
      gpm: dinheiro.nullable(),
    }),
    // GPM sai do Postgres em numeric: dinheiro não passa por float em lugar nenhum.
    sql`select coalesce(sum(s.gmv), 0)::numeric(18,2) as gmv,
               coalesce(sum(s.commission_estimated), 0)::numeric(18,2) as commission,
               coalesce(sum(s.quantity), 0)::int as units,
               case when ${views}::bigint > 0
                    then round(coalesce(sum(s.gmv), 0) * 1000 / ${views}::bigint, 2) end as gpm
          from order_skus s
         where s.account_id = ${accountId} and s.channel = 'VIDEO' and s.content_id = ${videoId}`,
  );
  return linha!;
}

export function snapshots(accountId: string, videoId: string) {
  return many(
    z.object({ at: z.date(), views: z.number().int(), likes: z.number().int() }),
    sql`select at, views::int as views, likes::int as likes
          from video_snapshots
         where account_id = ${accountId} and video_id = ${videoId}
         order by at`,
  );
}
