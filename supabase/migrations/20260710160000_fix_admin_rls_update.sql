-- AppBarber — Fix RLS para admin poder fazer UPDATE em shops e whatsapp_configs
-- O admin (welloliver@gmail.com) não tem shop próprio, então is_shop_owner() sempre retorna false.
-- As policies de UPDATE precisam incluir is_admin() para liberar o admin.

begin;

-- ─── 1. Garantir tabela admins ───────────────────────────────
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Insere admin por email se ainda não estiver na tabela
insert into admins (user_id)
select id from auth.users where email = 'welloliver@gmail.com'
on conflict (user_id) do nothing;

-- ─── 2. Função is_admin (security definer para bypass RLS) ──
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- ─── 3. SELECT policy em shops com is_admin() ──────────────
drop policy if exists "Users can read own shop" on shops;
create policy "Users can read own shop"
  on shops for select
  using (
    public.can_view_shop(id)
    or (auth.role() = 'authenticated' and owner_user_id is null)
    or public.is_admin()
  );

-- ─── 4. UPDATE policy em shops com is_admin() ──────────────
drop policy if exists "Users can update own shop" on shops;
create policy "Users can update own shop"
  on shops for update
  using (
    public.is_shop_owner(id)
    or (auth.role() = 'authenticated' and owner_user_id is null)
    or public.is_admin()
  )
  with check (
    public.is_shop_owner(id)
    or (auth.role() = 'authenticated' and owner_user_id = auth.uid())
    or public.is_admin()
  );

-- ─── 5. INSERT/DELETE policies em shops com is_admin() ─────
drop policy if exists "Users can delete own shop" on shops;
create policy "Users can delete own shop"
  on shops for delete
  using (public.is_shop_owner(id) or public.is_admin());

drop policy if exists "Users can insert own shop" on shops;
create policy "Users can insert own shop"
  on shops for insert
  with check (
    (auth.role() = 'authenticated' and owner_user_id = auth.uid())
    or public.is_admin()
  );

-- ─── 6. SELECT/UPDATE policies em whatsapp_configs com is_admin() ───
drop policy if exists "Users can read own whatsapp config" on whatsapp_configs;
create policy "Users can read own whatsapp config"
  on whatsapp_configs for select
  using (public.can_view_shop(shop_id) or public.is_admin());

drop policy if exists "Users can update own whatsapp config" on whatsapp_configs;
create policy "Users can update own whatsapp config"
  on whatsapp_configs for update
  using (public.is_shop_owner(shop_id) or public.is_admin())
  with check (public.is_shop_owner(shop_id) or public.is_admin());

-- ─── 7. INSERT/DELETE policies em whatsapp_configs ─────────
drop policy if exists "Users can insert own whatsapp config" on whatsapp_configs;
create policy "Users can insert own whatsapp config"
  on whatsapp_configs for insert
  with check (public.is_shop_owner(shop_id) or public.is_admin());

drop policy if exists "Users can delete own whatsapp config" on whatsapp_configs;
create policy "Users can delete own whatsapp config"
  on whatsapp_configs for delete
  using (public.is_shop_owner(shop_id) or public.is_admin());

commit;
