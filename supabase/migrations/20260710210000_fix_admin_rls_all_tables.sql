-- Adiciona public.is_admin() nas policies SELECT de barbers, barber_availability,
-- services, clients e appointments para permitir que admin (welloliver@gmail.com)
-- leia dados de qualquer loja.

begin;

-- ─── barbers ──────────────────────────────────────────────────────────────────
drop policy if exists "Users can read shop barbers" on barbers;
create policy "Users can read shop barbers"
  on barbers for select
  using (public.can_view_shop(shop_id) or public.is_admin());

-- ─── services ─────────────────────────────────────────────────────────────────
drop policy if exists "Users can read own services" on services;
create policy "Users can read own services"
  on services for select
  using (public.can_view_shop(shop_id) or public.is_admin());

-- ─── barber_availability ──────────────────────────────────────────────────────
drop policy if exists "Users can read barber availability" on barber_availability;
create policy "Users can read barber availability"
  on barber_availability for select
  using (
    exists (
      select 1
      from barbers
      where barbers.id = barber_availability.barber_id
        and (public.can_view_shop(barbers.shop_id) or public.is_admin())
    )
  );

-- ─── clients (SELECT mantém restritivo: só dono ou admin) ─────────────────────
drop policy if exists "Users can read own clients" on clients;
create policy "Users can read own clients"
  on clients for select
  using (public.is_shop_owner(shop_id) or public.is_admin());

-- ─── appointments (SELECT mantém restritivo: só dono ou admin) ─────────────────
drop policy if exists "Users can read own appointments" on appointments;
create policy "Users can read own appointments"
  on appointments for select
  using (public.is_shop_owner(shop_id) or public.is_admin());

commit;
