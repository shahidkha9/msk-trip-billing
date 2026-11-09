-- ============================================================
--  MSK Transport Service — ADD THE EXPENSES TABLE
--  Run this ONCE if your database was set up before the
--  Expenses / Profit update.
--  Supabase > SQL Editor > New query > paste ALL of this > Run
--  Safe to run more than once. It does NOT touch your trips.
-- ============================================================

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
