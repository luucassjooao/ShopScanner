import { z } from 'zod';
import { many, sql, type Executor } from '../lib/db.ts';

/* ------------------------------------------------------------------ pautas */

const roteiro = z.object({
  hook: z.string(),
  scene1: z.string(),
  scene2: z.string(),
  cta: z.string(),
  caption: z.string(),
});

const linhaPlano = z.object({
  id: z.guid(),
  title: z.string(),
  product_id: z.string().nullable(),
  scheduled_for: z.date().nullable(),
  status: z.string(),
  video_id: z.string().nullable(),
  script: roteiro.nullable(),
  notes: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type LinhaPlano = z.infer<typeof linhaPlano>;
export type Roteiro = z.infer<typeof roteiro>;

export type EntradaPlano = {
  title: string;
  productId: string | null;
  scheduledFor: Date | null;
  status: string;
  videoId: string | null;
  script: Roteiro | null;
  notes: string | null;
};

const colunasPlano = () => sql`id, title, product_id, scheduled_for, status::text as status,
                               video_id, script, notes, created_at, updated_at`;

export function listarPlanos(userId: string) {
  return many(
    linhaPlano,
    sql`select ${colunasPlano()} from plans where user_id = ${userId}
         order by coalesce(scheduled_for, created_at), created_at`,
  );
}

export async function criarPlano(userId: string, dados: EntradaPlano) {
  const [linha] = await many(
    linhaPlano,
    sql`insert into plans (user_id, title, product_id, scheduled_for, status, video_id,
                           script, notes)
        values (${userId}, ${dados.title}, ${dados.productId}, ${dados.scheduledFor},
                ${dados.status}::plan_status, ${dados.videoId},
                ${dados.script ? sql.json(dados.script) : null}, ${dados.notes})
        returning ${colunasPlano()}`,
  );
  return linha!;
}

/** Atualização parcial: campo ausente fica como está. */
export async function atualizarPlano(
  userId: string,
  id: string,
  dados: Partial<EntradaPlano>,
): Promise<LinhaPlano | null> {
  const [linha] = await many(
    linhaPlano,
    sql`update plans set
          title = coalesce(${dados.title ?? null}, title),
          product_id = ${'productId' in dados ? dados.productId! : sql`product_id`},
          scheduled_for = ${'scheduledFor' in dados ? dados.scheduledFor! : sql`scheduled_for`},
          status = coalesce(${dados.status ?? null}::plan_status, status),
          video_id = ${'videoId' in dados ? dados.videoId! : sql`video_id`},
          script = ${'script' in dados ? (dados.script ? sql.json(dados.script) : null) : sql`script`},
          notes = ${'notes' in dados ? dados.notes! : sql`notes`},
          updated_at = now()
        where id = ${id} and user_id = ${userId}
        returning ${colunasPlano()}`,
  );
  return linha ?? null;
}

export async function apagarPlano(userId: string, id: string) {
  const linhas = await sql`delete from plans where id = ${id} and user_id = ${userId} returning id`;
  return linhas.length;
}

/* ------------------------------------------------------------------- metas */

const linhaMeta = z.object({
  account_id: z.guid(),
  month: z.string(),
  gmv: z.string().nullable(),
  commission: z.string().nullable(),
});

export function listarMetas(userId: string) {
  return many(
    linhaMeta,
    sql`select g.account_id, g.month, g.gmv, g.commission
          from goals g
          join provider_connections c on c.id = g.account_id
         where c.user_id = ${userId}
         order by g.month desc`,
  );
}

export async function salvarMeta(dados: {
  accountId: string;
  month: string;
  gmv: string | null;
  commission: string | null;
}) {
  const [linha] = await many(
    linhaMeta,
    sql`insert into goals (account_id, month, gmv, commission)
        values (${dados.accountId}, ${dados.month}, ${dados.gmv}, ${dados.commission})
        on conflict (account_id, month) do update
           set gmv = excluded.gmv, commission = excluded.commission
        returning account_id, month, gmv, commission`,
  );
  return linha!;
}

/** Meta do mês corrente, em São Paulo: é o que `/summary` devolve em `goal`. */
export async function metaDoMes(accountId: string) {
  const [linha] = await many(
    z.object({ gmv: z.string().nullable(), commission: z.string().nullable() }),
    sql`select gmv, commission from goals
         where account_id = ${accountId}
           and month = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')`,
  );
  return linha ?? null;
}

/* ---------------------------------------------------------------- avisos */

const linhaAvisos = z.object({
  order_settled: z.boolean(),
  order_frozen: z.boolean(),
  order_refunded: z.boolean(),
  goal_reached: z.boolean(),
  pace_drop: z.boolean(),
  views_drop: z.boolean(),
  post_reminder: z.boolean(),
  channel_in_app: z.boolean(),
  channel_email: z.boolean(),
});

export type LinhaAvisos = z.infer<typeof linhaAvisos>;

/** Sem linha salva, valem os padrões da tabela. */
export async function preferencias(userId: string, db: Executor = sql): Promise<LinhaAvisos> {
  const [linha] = await many(
    linhaAvisos,
    db`insert into notification_settings (user_id) values (${userId})
       on conflict (user_id) do update set user_id = excluded.user_id
       returning order_settled, order_frozen, order_refunded, goal_reached, pace_drop,
                 views_drop, post_reminder, channel_in_app, channel_email`,
  );
  return linha!;
}

export async function salvarPreferencias(userId: string, p: LinhaAvisos) {
  const [linha] = await many(
    linhaAvisos,
    sql`insert into notification_settings
          (user_id, order_settled, order_frozen, order_refunded, goal_reached, pace_drop,
           views_drop, post_reminder, channel_in_app, channel_email)
        values (${userId}, ${p.order_settled}, ${p.order_frozen}, ${p.order_refunded},
                ${p.goal_reached}, ${p.pace_drop}, ${p.views_drop}, ${p.post_reminder},
                ${p.channel_in_app}, ${p.channel_email})
        on conflict (user_id) do update set
          order_settled = excluded.order_settled, order_frozen = excluded.order_frozen,
          order_refunded = excluded.order_refunded, goal_reached = excluded.goal_reached,
          pace_drop = excluded.pace_drop, views_drop = excluded.views_drop,
          post_reminder = excluded.post_reminder, channel_in_app = excluded.channel_in_app,
          channel_email = excluded.channel_email
        returning order_settled, order_frozen, order_refunded, goal_reached, pace_drop,
                  views_drop, post_reminder, channel_in_app, channel_email`,
  );
  return linha!;
}
