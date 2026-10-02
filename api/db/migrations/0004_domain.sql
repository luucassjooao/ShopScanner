-- Domínio: pedidos, vídeos, produtos, pautas, metas e preferências.
-- Dinheiro em numeric(18,2) (lido como texto), taxa em integer (centésimos de %),
-- data em timestamptz. Nunca float, nunca dinheiro em number.

create type order_status as enum (
  'AWAITING_PAYMENT', 'TO_SETTLE', 'SETTLED', 'REFUNDED', 'FROZEN', 'INELIGIBLE'
);
create type sale_channel as enum (
  'VIDEO', 'LIVE', 'PRE_LIVE', 'SHOP', 'LINKSHARE', 'PROMOTION_PAGE'
);
create type data_source as enum ('API', 'FILE', 'ESTIMATED');
create type plan_status as enum ('IDEA', 'SCRIPT', 'RECORDED', 'EDITED', 'POSTED');

-- Conexão criada por import de arquivo não tem token nenhum: o relatório é
-- subido pela creator, sem OAuth. Por isso o token passa a poder faltar.
alter table provider_connections alter column access_token drop not null;

/* ------------------------------------------------------------------ pedidos */

create table orders (
  account_id   uuid         not null references provider_connections (id) on delete cascade,
  id           text         not null,          -- id do pedido no TikTok
  created_at   timestamptz  not null,          -- quando o pedido foi feito
  delivered_at timestamptz,
  status       order_status not null,
  currency     text         not null default 'BRL',
  source       data_source  not null,
  source_at    timestamptz  not null,          -- quando esta fonte leu o dado
  ingested_at  timestamptz  not null default now(),
  primary key (account_id, id),
  -- INELIGIBLE é rótulo que só existe no arquivo; a API separa em REFUNDED e FROZEN.
  constraint orders_ineligible_so_de_arquivo
    check (status <> 'INELIGIBLE' or source = 'FILE')
);

create index orders_account_created_idx on orders (account_id, created_at);
create index orders_account_status_idx on orders (account_id, status);

-- O relatório do TikTok repete o mesmo id de SKU em linhas diferentes do mesmo
-- pedido (quantidades separadas do mesmo produto). Por isso a chave carrega a
-- posição da linha: id de SKU sozinho não identifica item.
create table order_skus (
  account_id                    uuid           not null,
  order_id                      text           not null,
  line_no                       integer        not null,
  id                            text           not null,
  product_id                    text           not null,
  name                          text           not null,
  shop_name                     text           not null,
  unit_price                    numeric(18, 2) not null,
  quantity                      integer        not null,
  returned_quantity             integer        not null default 0,
  refunded_quantity             integer        not null default 0,
  gmv                           numeric(18, 2) not null,  -- preço × quantidade
  commission_base_actual        numeric(18, 2),           -- só em SETTLED
  commission_rate               integer        not null,  -- total, em centésimos de %
  rate_standard                 integer        not null,
  rate_shop_ads                 integer        not null,
  rate_bonus                    integer        not null,
  rate_reward                   integer        not null,
  commission_estimated          numeric(18, 2) not null,
  commission_settled            numeric(18, 2),           -- só em SETTLED
  shop_ads_commission_estimated numeric(18, 2) not null,
  channel                       sale_channel   not null,
  content_id                    text,
  primary key (account_id, order_id, line_no),
  foreign key (account_id, order_id) references orders (account_id, id) on delete cascade
);

create index order_skus_account_channel_idx on order_skus (account_id, channel);
create index order_skus_account_product_idx on order_skus (account_id, product_id);
-- Suposição isolada: content_id de pedido VIDEO = id do vídeo da Display API.
create index order_skus_account_content_idx on order_skus (account_id, content_id);

create table order_status_history (
  account_id uuid         not null,
  order_id   text         not null,
  status     order_status not null,
  at         timestamptz  not null,
  primary key (account_id, order_id, status, at),
  foreign key (account_id, order_id) references orders (account_id, id) on delete cascade
);

/* ------------------------------------------------------------------- vídeos */

create table videos (
  account_id  uuid        not null references provider_connections (id) on delete cascade,
  id          text        not null,
  title       text        not null default '',
  description text        not null default '',
  posted_at   timestamptz not null,
  duration    integer     not null default 0,
  cover_url   text,
  share_url   text,
  views       bigint      not null default 0,
  likes       bigint      not null default 0,
  comments    bigint      not null default 0,
  shares      bigint      not null default 0,
  primary key (account_id, id)
);

create index videos_account_posted_idx on videos (account_id, posted_at);

-- Views são total acumulado na origem; a série no tempo vem daqui.
create table video_snapshots (
  account_id uuid        not null,
  video_id   text        not null,
  at         timestamptz not null,
  views      bigint      not null,
  likes      bigint      not null,
  primary key (account_id, video_id, at),
  foreign key (account_id, video_id) references videos (account_id, id) on delete cascade
);

/* ----------------------------------------------------------------- produtos */

-- Catálogo. As linhas de produto das telas são agregadas dos pedidos; daqui
-- vêm só imagem e link, que a venda não carrega.
create table products (
  account_id uuid not null references provider_connections (id) on delete cascade,
  id         text not null,
  name       text,
  shop_name  text,
  image_url  text,
  detail_url text,
  primary key (account_id, id)
);

/* -------------------------------------------------- planejamento e metas */

create table plans (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references users (id) on delete cascade,
  title         text        not null,
  product_id    text,
  scheduled_for timestamptz,
  status        plan_status not null default 'IDEA',
  video_id      text,
  script        jsonb,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index plans_user_idx on plans (user_id, created_at);

create table goals (
  account_id uuid not null references provider_connections (id) on delete cascade,
  month      text not null check (month ~ '^\d{4}-\d{2}$'),
  gmv        numeric(18, 2),
  commission numeric(18, 2),
  primary key (account_id, month)
);

create table notification_settings (
  user_id         uuid    primary key references users (id) on delete cascade,
  order_settled   boolean not null default true,
  order_frozen    boolean not null default true,
  order_refunded  boolean not null default true,
  goal_reached    boolean not null default true,
  pace_drop       boolean not null default true,
  views_drop      boolean not null default true,
  post_reminder   boolean not null default true,
  channel_in_app  boolean not null default true,
  -- E-mail fica desligado no MVP: não existe envio ainda.
  channel_email   boolean not null default false
);
