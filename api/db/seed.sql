-- Dados fixos de desenvolvimento: a creator de demonstração e a conta dela.
-- O volume (pedidos, vídeos, produtos) vem de scripts/seed-from-mocks.ts.
-- Idempotente: rodar de novo não duplica nem sobrescreve.

-- Senha: demo-shopscanner
insert into users (id, name, email, email_verified_at, password_hash, accepted_terms_version)
values (
  '00000000-0000-0000-0000-000000000001',
  'Creator Demo',
  'demo@shopscanner.app',
  now(),
  '$argon2id$v=19$m=65536,p=4,t=3$lEul4C7qSPJj4gZdFrxOeg$EaVsKLaXAIdGvG860DNNJBRVkho5IiXPLJZZrYjdHXE',
  '2026-09-01'
)
on conflict (id) do nothing;

-- Conta conectada. Sem token: o dado da demonstração vem de arquivo, não de
-- OAuth — é o mesmo caso do import de relatório, que não tem token nenhum.
insert into provider_connections
  (id, user_id, provider, kind, provider_user_id, username, avatar_url, access_token, scopes)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001',
   'TIKTOK', 'VIDEOS', 'demo-open-id', '@creator.demo', null, null,
   '{user.info.basic,video.list}'),
  -- A parte de pedidos entra ligada só na demonstração, para as telas com
  -- venda aparecerem. Apague esta linha para ver o estado "sem Shop".
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001',
   'TIKTOK', 'SHOP', 'demo-open-id', '@creator.demo', null, null, '{}')
on conflict (user_id, provider, kind, provider_user_id) do nothing;
