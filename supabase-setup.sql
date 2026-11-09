-- ============================================================
--  MSK Transport Service — database setup
--  Supabase > SQL Editor > New query > paste ALL of this > Run
--  Safe to run more than once.
-- ============================================================

-- 1) Trips table (one row per trip)
create table if not exists public.trips (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists trips_user_idx on public.trips(user_id);

-- 2) Settings table (rates, locations, business name — one row per user)
create table if not exists public.settings (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- 3) Security: every user can see and change ONLY their own data
alter table public.trips    enable row level security;
alter table public.settings enable row level security;

drop policy if exists "own trips"    on public.trips;
drop policy if exists "own settings" on public.settings;

create policy "own trips" on public.trips
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own settings" on public.settings
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) Allow logged-in users to use the tables (nobody else)
revoke all on public.trips, public.settings from anon;
grant select, insert, update, delete on public.trips    to authenticated;
grant select, insert, update, delete on public.settings to authenticated;

-- 5) Expenses table (driver salary, repairs, etc.)
create table if not exists public.expenses (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists expenses_user_idx on public.expenses(user_id);
alter table public.expenses enable row level security;
drop policy if exists "own expenses" on public.expenses;
create policy "own expenses" on public.expenses
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.expenses from anon;
grant select, insert, update, delete on public.expenses to authenticated;
