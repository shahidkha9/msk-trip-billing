-- ============================================================
--  Transport Ledger — COMPLETE DATABASE SETUP
--  Works for a NEW project and for UPGRADING an existing one.
--  Supabase > SQL Editor > New query > paste ALL of this > Run
--  Safe to run more than once. It never deletes your data.
-- ============================================================

-- 1) Data tables (one row per item; details are stored in "data")
create table if not exists public.trips (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.expenses  (like public.trips including all);
create table if not exists public.customers (like public.trips including all);
create table if not exists public.vehicles  (like public.trips including all);
create table if not exists public.receipts  (like public.trips including all);

-- Settings: one row per account
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- "like ... including all" does not copy the foreign key, so add it
do $$
declare t text;
begin
  foreach t in array array['expenses','customers','vehicles','receipts'] loop
    if not exists (
      select 1 from pg_constraint where conname = t || '_user_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
        t, t || '_user_id_fkey');
    end if;
  end loop;
end $$;

-- 2) Profiles: one per account — subscription / trial / admin
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text,
  business_name  text,
  phone          text,
  status         text not null default 'active' check (status in ('active', 'suspended')),
  is_admin       boolean not null default false,
  trial_ends_at  timestamptz,
  paid_until     timestamptz,
  admin_note     text,
  created_at     timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 3) Helper functions
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false);
$$;

-- true when the account may add/change data (admin, or trial / paid period not over, and not suspended)
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'active'
      and (p.is_admin
           or greatest(coalesce(p.trial_ends_at, '-infinity'::timestamptz),
                       coalesce(p.paid_until,    '-infinity'::timestamptz)) > now())
  );
$$;

-- 4) Every new sign-up gets a profile with a 30-day free trial
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, business_name, phone, trial_ends_at)
  values (new.id, new.email,
          new.raw_user_meta_data ->> 'business_name',
          new.raw_user_meta_data ->> 'phone',
          now() + interval '30 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that existed before this setup also get a profile (30-day trial)
insert into public.profiles (user_id, email, trial_ends_at)
select u.id, u.email, now() + interval '30 days' from auth.users u
on conflict (user_id) do nothing;

-- 5) Security rules
--    Read: only your own data (always allowed, so you can export it).
--    Add / change / delete: only your own data AND only while your account is active.
do $$
declare t text;
begin
  foreach t in array array['trips','settings','expenses','customers','vehicles','receipts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    -- remove rules from older versions
    execute format('drop policy if exists %I on public.%I', 'own ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'own ' || rtrim(t, 's'), t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    -- new rules
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid() and public.can_write())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid() and public.can_write()) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid() and public.can_write())', t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;

-- 6) Admin tools (they refuse to work for anyone who is not admin)
create or replace function public.admin_list_users()
returns table (
  user_id uuid, email text, business_name text, phone text, status text, is_admin boolean,
  trial_ends_at timestamptz, paid_until timestamptz, admin_note text, created_at timestamptz,
  trip_count bigint, last_activity timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.email, p.business_name, p.phone, p.status, p.is_admin,
         p.trial_ends_at, p.paid_until, p.admin_note, p.created_at,
         (select count(*) from public.trips t where t.user_id = p.user_id),
         (select max(t.updated_at) from public.trips t where t.user_id = p.user_id)
  from public.profiles p
  where public.is_admin()
  order by p.created_at desc;
$$;

create or replace function public.admin_update_user(
  p_target uuid, p_status text, p_trial_ends timestamptz, p_paid_until timestamptz, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do this';
  end if;
  update public.profiles
     set status = p_status, trial_ends_at = p_trial_ends, paid_until = p_paid_until, admin_note = p_note
   where profiles.user_id = p_target;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_update_user(uuid, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.can_write() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ============================================================
--  DONE. Next: make yourself the admin — see make-me-admin.sql
-- ============================================================
