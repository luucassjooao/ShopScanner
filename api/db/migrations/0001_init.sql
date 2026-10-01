-- Primeira migração: só o registro das migrações e a extensão de cripto.
-- Migração aplicada não se edita; qualquer mudança vira um arquivo novo.
create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  name       text        primary key,
  applied_at timestamptz not null default now()
);
