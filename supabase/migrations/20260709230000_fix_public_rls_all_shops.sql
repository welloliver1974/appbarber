-- Fix RLS: allow anonymous public site access to ALL shops (not just the first)

begin;

-- Update can_view_shop to allow anon for ANY shop
create or replace function public.can_view_shop(shop_uuid uuid)
returns boolean
language sql
stable
security definer
as $$
  select public.is_shop_owner(shop_uuid)
    or (auth.role() = 'anon')
$$;

-- Insert policies for clients and appointments (allow anon for any shop)
drop policy if exists "Users can insert own clients" on clients;
create policy "Users can insert own clients"
  on clients for insert
  with check (
    public.is_shop_owner(shop_id)
    or (auth.role() = 'anon')
  );

drop policy if exists "Users can insert own appointments" on appointments;
create policy "Users can insert own appointments"
  on appointments for insert
  with check (
    public.is_shop_owner(shop_id)
    or (auth.role() = 'anon')
  );

-- Protect SELECT on clients and appointments from anon users
drop policy if exists "Users can read own clients" on clients;
create policy "Users can read own clients"
  on clients for select
  using (public.is_shop_owner(shop_id));

drop policy if exists "Users can read own appointments" on appointments;
create policy "Users can read own appointments"
  on appointments for select
  using (public.is_shop_owner(shop_id));

commit;
