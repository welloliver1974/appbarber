-- AppBarber — Fix RLS Policies + Admin Setup
-- Execute no Supabase Dashboard > SQL Editor
-- 1º executa este bloco inteiro
-- 2º depois roda o INSERT do admin separadamente

begin;

-- ─── 1. Colunas faltantes ───────────────────────────────────
alter table shops
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists public_slug text,
  add column if not exists instagram text,
  add column if not exists working_hours jsonb default '{}',
  add column if not exists gallery_photos jsonb default '[]',
  add column if not exists hero_photo text;

drop index if exists idx_shops_public_slug;
create unique index if not exists idx_shops_public_slug on shops (public_slug) where public_slug is not null;

-- ─── 2. Tabela de admins ────────────────────────────────────
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table admins enable row level security;

drop policy if exists "Admins can read admins" on admins;
create policy "Admins can read admins"
  on admins for select
  using (auth.role() = 'authenticated');

-- ─── 3. Função is_admin (precisa existir ANTES das policies) ─
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- ─── 4. Políticas RLS ────────────────────────────────────────
drop policy if exists "Users can read own shop" on shops;
create policy "Users can read own shop"
  on shops for select
  using (
    can_view_shop(id)
    or (auth.role() = 'authenticated' and owner_user_id is null)
    or public.is_admin()
  );

drop policy if exists "Users can insert own shop" on shops;
create policy "Users can insert own shop"
  on shops for insert
  with check (auth.role() = 'authenticated' and owner_user_id = auth.uid());

drop policy if exists "Users can update own shop" on shops;
create policy "Users can update own shop"
  on shops for update
  using (
    is_shop_owner(id)
    or (auth.role() = 'authenticated' and owner_user_id is null)
  )
  with check (
    is_shop_owner(id)
    or (auth.role() = 'authenticated' and owner_user_id = auth.uid())
  );

drop policy if exists "Users can delete own shop" on shops;
create policy "Users can delete own shop"
  on shops for delete
  using (public.is_shop_owner(id) or public.is_admin());

-- ─── 5. Funções RPC para o admin (bypass RLS via security definer) ─
-- O admin (welloliver@gmail.com) usa estas funções no painel Admin
-- para ver todas as lojas e criar novas, sem depender de RLS.

create or replace function public.admin_get_all_shops()
returns json
language plpgsql
security definer
as $$
declare
  admin_email text;
  result json;
begin
  -- Verifica se o usuário logado é admin
  select email into admin_email from auth.users where id = auth.uid();
  if admin_email is distinct from 'welloliver@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  select json_agg(row_to_json(s)) into result
  from (select * from shops order by created_at desc) s;

  return coalesce(result, '[]'::json);
end;
$$;

create or replace function public.admin_create_shop(shop_name text, owner_id text default null)
returns json
language plpgsql
security definer
as $$
declare
  admin_email text;
  new_shop shops;
begin
  select email into admin_email from auth.users where id = auth.uid();
  if admin_email is distinct from 'welloliver@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  insert into shops (name, owner_user_id)
  values (shop_name, nullif(owner_id, '')::uuid)
  returning * into new_shop;

  return row_to_json(new_shop);
end;
$$;

create or replace function public.admin_delete_shop(shop_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  admin_email text;
begin
  select email into admin_email from auth.users where id = auth.uid();
  if admin_email is distinct from 'welloliver@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  delete from shops where id = shop_id;
end;
$$;

-- ─── 6. public_slug para lojas existentes ────────────────────
update shops
set public_slug = 'barbearia-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where public_slug is null;

commit;
