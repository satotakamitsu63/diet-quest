-- ダイエットクエスト用スキーマ
-- Supabase の SQL Editor にこのファイルの内容を貼り付けて一度だけ実行する。

create extension if not exists "pgcrypto";

create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.family_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  birth_date date,
  age_years integer,
  sex text not null check (sex in ('male', 'female')),
  height_cm numeric,
  activity_level integer not null default 2 check (activity_level between 1 and 3),
  is_menstruating boolean not null default false,
  goal_preset text not null default 'ideal',
  custom_target_weight_kg numeric,
  custom_target_bmi numeric,
  custom_target_body_fat_percent numeric,
  aesthetic_sport_mode boolean not null default false,
  growth_boost boolean not null default true,
  father_height_cm numeric,
  mother_height_cm numeric,
  target_adult_height_cm numeric,
  species text not null default 'cat' check (species in ('cat', 'dog', 'rabbit', 'bear', 'penguin', 'dragon')),
  character_name text not null,
  club text not null default 'none',
  custom_special_move_name text,
  awards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  raw_text text not null default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meal_logs_profile_date_idx on public.meal_logs (profile_id, date);

create table if not exists public.body_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  weight_kg numeric,
  height_cm numeric,
  body_fat_percent numeric,
  unique (profile_id, date)
);

-- 所属している家族グループのデータだけを読み書きできるようにする
create or replace function public.is_group_member(target_group uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid()
  );
$$;

-- 合言葉を知っている人だけがグループに参加できる
create or replace function public.join_group_with_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group uuid;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません。先にログインしてください';
  end if;
  select id into target_group from public.family_groups where invite_code = upper(code);
  if target_group is null then
    raise exception '合言葉に一致する家族グループが見つかりません';
  end if;
  insert into public.group_members (group_id, user_id)
  values (target_group, auth.uid())
  on conflict do nothing;
  return target_group;
end;
$$;

-- 家族グループを新しく作り、作った人を最初のメンバーにする
create or replace function public.create_group_with_code(group_name text, code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group uuid;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません。先にログインしてください';
  end if;
  insert into public.family_groups (name, invite_code)
  values (group_name, upper(code))
  returning id into new_group;
  insert into public.group_members (group_id, user_id) values (new_group, auth.uid());
  return new_group;
end;
$$;

-- 既に profiles を作ってある場合の追加分
alter table public.profiles add column if not exists custom_target_weight_kg numeric;
alter table public.profiles add column if not exists growth_boost boolean not null default true;
alter table public.profiles add column if not exists father_height_cm numeric;
alter table public.profiles add column if not exists mother_height_cm numeric;
alter table public.profiles add column if not exists target_adult_height_cm numeric;
alter table public.profiles add column if not exists club text not null default 'none';
alter table public.profiles add column if not exists custom_special_move_name text;
alter table public.profiles add column if not exists awards jsonb not null default '[]'::jsonb;
alter table public.profiles drop constraint if exists profiles_species_check;
alter table public.profiles add constraint profiles_species_check
  check (species in ('cat', 'dog', 'rabbit', 'bear', 'penguin', 'dragon'));

alter table public.family_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.profiles enable row level security;
alter table public.meal_logs enable row level security;
alter table public.body_logs enable row level security;

drop policy if exists family_groups_member_read on public.family_groups;
create policy family_groups_member_read on public.family_groups
  for select using (public.is_group_member(id));

drop policy if exists group_members_self_read on public.group_members;
create policy group_members_self_read on public.group_members
  for select using (user_id = auth.uid() or public.is_group_member(group_id));

drop policy if exists profiles_member_all on public.profiles;
create policy profiles_member_all on public.profiles
  for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy if exists meal_logs_member_all on public.meal_logs;
create policy meal_logs_member_all on public.meal_logs
  for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy if exists body_logs_member_all on public.body_logs;
create policy body_logs_member_all on public.body_logs
  for all using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

-- 家族の記録がその場で反映されるようにする。
-- すでに追加済みの場合にエラーで止まらないよう、存在を確かめてから追加する。
do $$
declare
  target text;
begin
  foreach target in array array['profiles', 'meal_logs', 'body_logs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end $$;
