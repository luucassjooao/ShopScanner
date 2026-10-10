-- Importação de relatório: um lote por envio, com o resultado ou o motivo da
-- recusa. Os bytes do arquivo ficam em tabela própria para a listagem não
-- carregar 50 MB por linha.

create type import_kind as enum ('FILE', 'SYNC', 'RECHECK');
create type import_status as enum ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

create table import_batches (
  id            uuid          primary key default gen_random_uuid(),
  account_id    uuid          not null references provider_connections (id) on delete cascade,
  kind          import_kind   not null,
  file_name     text,
  status        import_status not null default 'QUEUED',
  created_at    timestamptz   not null default now(),
  finished_at   timestamptz,
  result        jsonb,                          -- { created, updated, unchanged, skipped }
  error_code    text,
  error_message text,
  columns_found   text[],
  columns_missing text[]
);

create index import_batches_account_created_idx on import_batches (account_id, created_at desc);
create index import_batches_status_idx on import_batches (status) where status = 'QUEUED';

create table import_files (
  import_id uuid  primary key references import_batches (id) on delete cascade,
  content   bytea not null
);
