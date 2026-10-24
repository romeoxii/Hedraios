-- Tables
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '',
  mood text,
  tags text[] not null default '{}',
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  detail text not null default '',
  status text not null default 'active' check (status in ('active', 'answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  reference text not null,
  notes text not null default '',
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists entries_user_created_idx on public.entries (user_id, created_at desc);
create index if not exists prayers_user_status_idx on public.prayers (user_id, status, created_at desc);
create index if not exists readings_user_date_idx on public.readings (user_id, date desc);

-- Backfills for tables created before image uploads existed.
alter table public.entries add column if not exists image_urls text[] not null default '{}';
alter table public.readings add column if not exists image_urls text[] not null default '{}';

-- Row Level Security
alter table public.entries enable row level security;
alter table public.prayers enable row level security;
alter table public.readings enable row level security;

-- Only owners touch their rows. Old rules drop first so this runs twice clean.
drop policy if exists "owner all entries" on public.entries;
create policy "owner all entries" on public.entries
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all prayers" on public.prayers;
create policy "owner all prayers" on public.prayers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all readings" on public.readings;
create policy "owner all readings" on public.readings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rules alone don't open the tables; access gets granted here too.
grant select, insert, update, delete on public.entries to authenticated;
grant select, insert, update, delete on public.prayers to authenticated;
grant select, insert, update, delete on public.readings to authenticated;

-- Image attachments for notes + readings live in one private bucket.
-- Run once in the Supabase SQL editor (storage schema isn't in local migrations).
insert into storage.buckets (id, name, public)
values ('entry-images', 'entry-images', false)
on conflict (id) do nothing;

drop policy if exists "owners manage entry images" on storage.objects;
create policy "owners manage entry images" on storage.objects
  for all to authenticated
  using (bucket_id = 'entry-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'entry-images' and auth.uid()::text = (storage.foldername(name))[1]);



