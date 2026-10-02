-- Conexões com terceiros. Não se misturam com auth_identities: identidade é
-- como a pessoa entra no app; conexão é conta de terceiro que o app lê depois.
-- O TikTok entra em duas partes independentes, que conectam e expiram sozinhas:
-- VIDEOS (Display API) e SHOP (pedidos, ainda não liberado no Brasil).
create table provider_connections (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references users (id) on delete cascade,
  provider         text        not null check (provider in ('TIKTOK')),
  kind             text        not null check (kind in ('VIDEOS', 'SHOP')),
  provider_user_id text        not null,
  username         text,
  avatar_url       text,
  -- AES-256-GCM. key_version permite trocar a chave sem reconectar todo mundo.
  access_token     bytea       not null,
  refresh_token    bytea,
  key_version      integer     not null default 1,
  scopes           text[]      not null default '{}',
  connected_at     timestamptz not null default now(),
  expires_at       timestamptz,
  last_synced_at   timestamptz,
  revoked_at       timestamptz,
  unique (user_id, provider, kind, provider_user_id)
);

create index provider_connections_user_id_idx on provider_connections (user_id);
