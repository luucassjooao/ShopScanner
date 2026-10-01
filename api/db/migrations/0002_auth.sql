-- Identidade de acesso e sessão. Conexões com terceiros (TikTok) são outra
-- coisa e virão em provider_connections, em migração própria.
create extension if not exists citext;

create table users (
  id                     uuid        primary key default gen_random_uuid(),
  name                   text        not null,
  -- citext: e-mail não distingue maiúscula. O unique já é o índice de busca
  -- por e-mail, por isso não existe um create index users_email_idx separado.
  email                  citext      unique,
  email_verified_at      timestamptz,
  password_hash          text,
  avatar_url             text,
  accepted_terms_version text,
  credentials_version    integer     not null default 1,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

create table sessions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references users (id) on delete cascade,
  user_agent     text,
  ip             inet,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_reason text
);

create index sessions_user_id_idx on sessions (user_id);

create table refresh_tokens (
  -- token_hash é SHA-256 com pepper; o token em si nunca encosta no banco,
  -- e o id da linha nunca é o token. O unique já indexa o hash.
  id             uuid        primary key default gen_random_uuid(),
  session_id     uuid        not null references sessions (id) on delete cascade,
  token_hash     bytea       not null unique,
  family_id      uuid        not null,
  issued_at      timestamptz not null default now(),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  replaced_by_id uuid        references refresh_tokens (id) on delete set null
);

create index refresh_tokens_family_id_idx on refresh_tokens (family_id);

create table auth_identities (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references users (id) on delete cascade,
  provider         text        not null check (provider in ('GOOGLE')),
  provider_user_id text        not null,
  email            citext,
  created_at       timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index auth_identities_user_id_idx on auth_identities (user_id);
