-- AppBarber — Fix RLS Policies
-- Execute no Supabase Dashboard > SQL Editor
-- Resolve o erro 403 ao tentar criar/editar barbearia

begin;

-- 1. Garantir que colunas necessárias existem
alter table shops
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists public_slug text,
  add column if not exists instagram text,
  add column if not exists working_hours jsonb default '{}',
  add column if not exists gallery_photos jsonb default '[]',
  add column if not exists hero_photo text;

-- 2. Garantir que public_slug é unique
drop index if exists idx_shops_public_slug;
create unique index if not exists idx_shops_public_slug on shops (public_slug) where public_slug is not null;

-- 3. Remover políticas antigas e recriar com regras corretas

drop policy if exists "Users can read own shop" on shops;
drop policy if exists "Users can insert own shop" on shops;
drop policy if exists "Users can update own shop" on shops;
drop policy if exists "Users can delete own shop" on shops;

-- SELECT: permite ver próprias lojas, lojas sem dono, e anônimos verem a primeira loja
create policy "Users can read own shop"
  on shops for select
  using (
    can_view_shop(id)
    or (auth.role() = 'authenticated' and owner_user_id is null)
  );

-- INSERT: usuário autenticado pode criar loja com seu próprio ID
create policy "Users can insert own shop"
  on shops for insert
  with check (auth.role() = 'authenticated' and owner_user_id = auth.uid());

-- UPDATE: permite atualizar própria loja ou assumir loja sem dono
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

-- DELETE: só o dono pode excluir
create policy "Users can delete own shop"
  on shops for delete
  using (is_shop_owner(id));

-- 4. Tabela de admins do SaaS
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table admins enable row level security;

drop policy if exists "Admins can read admins" on admins;
create policy "Admins can read admins"
  on admins for select
  using (auth.role() = 'authenticated');

-- Função para verificar se usuário é admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- Inserir admin inicial (welloliver@gmail.com)
-- O UUID precisa ser substituído pelo ID real do usuário no seu projeto
-- Busque em: Authentication > Users
-- insert into admins (user_id) values ('SUBSTITUA_PELO_UUID_DO_ADMIN');

-- 5. Atualizar política SELECT para admin ver todas as lojas
drop policy if exists "Users can read own shop" on shops;
create policy "Users can read own shop"
  on shops for select
  using (
    can_view_shop(id)
    or (auth.role() = 'authenticated' and owner_user_id is null)
    or public.is_admin()
  );

-- 6. Atualizar política DELETE para admin poder excluir qualquer loja
drop policy if exists "Users can delete own shop" on shops;
create policy "Users can delete own shop"
  on shops for delete
  using (public.is_shop_owner(id) or public.is_admin());

-- 7. Se existir uma loja sem public_slug, gerar um
update shops
set public_slug = 'barbearia-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where public_slug is null;

commit;
