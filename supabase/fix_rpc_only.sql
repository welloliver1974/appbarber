-- ============================================================
-- SETUP COMPLETO — AppBarber
-- Execute TUDO no Supabase SQL Editor (uma vez só)
-- https://supabase.com/dashboard/project/chtjqqtvvlamrdesaiwp/sql/new
-- ============================================================

-- 0. Add auth_email column (se não existir ainda)
alter table shops add column if not exists auth_email text;

-- 1. Login: lookup auth_email pelo nome da barbearia
create or replace function public.lookup_shop_auth_email(shop_name text)
returns text
language plpgsql
security definer
as $$
declare
  result text;
begin
  select auth_email into result from shops
  where name = shop_name
  limit 1;
  return result;
end;
$$;

-- 2. Admin: listar todas as lojas
create or replace function public.admin_get_all_shops()
returns json
language plpgsql
security definer
as $$
declare
  admin_email text;
  result json;
begin
  select email into admin_email from auth.users where id = auth.uid();
  if admin_email is distinct from 'welloliver@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  select json_agg(row_to_json(s)) into result
  from (select * from shops order by created_at desc) s;

  return coalesce(result, '[]'::json);
end;
$$;

-- 3. Admin: criar barbearia
create or replace function public.admin_create_shop(
  shop_name text,
  owner_id text default null,
  auth_email text default null
)
returns json
language plpgsql
security definer
as $$
declare
  admin_email text;
  new_shop shops;
  generated_email text;
begin
  select email into admin_email from auth.users where id = auth.uid();
  if admin_email is distinct from 'welloliver@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  if auth_email is null or auth_email = '' then
    generated_email := 'shop-' || lower(regexp_replace(shop_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6) || '@appbarber.app';
  else
    generated_email := auth_email;
  end if;

  insert into shops (name, owner_user_id, auth_email)
  values (shop_name, nullif(owner_id, '')::uuid, generated_email)
  returning * into new_shop;

  return row_to_json(new_shop);
end;
$$;

-- 4. Admin: excluir barbearia
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

-- 5. Admin: atualizar dados da barbearia
create or replace function public.admin_update_shop(
  shop_id uuid,
  shop_name text default null,
  shop_phone text default null,
  shop_address text default null,
  shop_logo text default null,
  shop_instagram text default null
)
returns json
language plpgsql
security definer
as $$
declare
  admin_email text;
  updated shops;
begin
  select email into admin_email from auth.users where id = auth.uid();
  if admin_email is distinct from 'welloliver@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  update shops set
    name = coalesce(shop_name, name),
    phone = coalesce(shop_phone, phone),
    address = coalesce(shop_address, address),
    logo_url = coalesce(shop_logo, logo_url),
    instagram = coalesce(shop_instagram, instagram)
  where id = shop_id
  returning * into updated;

  return row_to_json(updated);
end;
$$;

-- 6. RLS: permitir que admin veja TODAS as lojas (SELECT)
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
declare
  user_email text;
begin
  select email into user_email from auth.users where id = auth.uid();
  return user_email = 'welloliver@gmail.com';
end;
$$;

-- Só cria a policy se não existir (evita erro se já existir)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'shops' and policyname = 'Admins can select all shops'
  ) then
    create policy "Admins can select all shops" on shops
      for select using (public.is_admin());
  end if;
end;
$$;
