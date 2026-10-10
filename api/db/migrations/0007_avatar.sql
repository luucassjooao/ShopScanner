-- Foto de perfil enviada pela própria pessoa. Os bytes ficam aqui, e não em
-- disco, para que apagar a conta (cascade) leve a foto junto, como manda a LGPD.
-- users.avatar_url guarda o caminho relativo com o hash: /me/avatar?v=<hash>.

create table user_avatars (
  user_id    uuid        primary key references users (id) on delete cascade,
  content    bytea       not null,
  mime       text        not null,
  hash       text        not null,
  updated_at timestamptz not null default now()
);
