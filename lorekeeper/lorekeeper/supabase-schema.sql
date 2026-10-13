-- ============================================================
-- Lorekeeper — cloud sync schema (Supabase / Postgres)
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Each signed-in user sees only their own worlds (Row Level Security).
-- ============================================================

-- One row per world; the full world (entries, events, relationships,
-- images) lives in the `data` JSONB column, matching the app's format.
create table if not exists public.worlds (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'Untitled world',
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  is_public  boolean not null default false
);

-- Tombstones: remembered deletions so a world deleted on one device
-- isn't resurrected by a sync from another device.
create table if not exists public.deleted_worlds (
  world_id   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  deleted_at timestamptz not null default now()
);

-- Keep every user's worlds private to them.
-- (`is_public` exists so read-only shared world pages can be added later:
--  signed-out visitors may read worlds explicitly marked public.)
alter table public.worlds enable row level security;
alter table public.deleted_worlds enable row level security;

-- Policies are dropped first so this file can be re-run safely.
drop policy if exists "read own or public worlds" on public.worlds;
drop policy if exists "insert own worlds" on public.worlds;
drop policy if exists "update own worlds" on public.worlds;
drop policy if exists "delete own worlds" on public.worlds;
drop policy if exists "manage own tombstones" on public.deleted_worlds;

create policy "read own or public worlds"
  on public.worlds for select
  using (auth.uid() = user_id or is_public);

create policy "insert own worlds"
  on public.worlds for insert
  with check (auth.uid() = user_id);

create policy "update own worlds"
  on public.worlds for update
  using (auth.uid() = user_id);

create policy "delete own worlds"
  on public.worlds for delete
  using (auth.uid() = user_id);

create policy "manage own tombstones"
  on public.deleted_worlds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Table permissions. Some projects don't inherit Supabase's
-- default grants when tables are created via SQL — without this
-- the app gets "permission denied for table worlds".
-- RLS above still keeps each user's data private: these grants
-- allow access only to rows the policies permit.
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;

create index if not exists worlds_user_idx on public.worlds (user_id);
