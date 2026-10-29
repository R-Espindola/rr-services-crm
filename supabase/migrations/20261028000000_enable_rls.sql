-- R&R Services: identity binding and baseline RLS policies.
-- Apply after database/migrations/001_add_role_to_clients.sql.
-- Existing clients are linked to auth.users by exact normalized email. Review
-- unmatched rows after applying; they remain unable to read/write client data.

begin;

alter table public.clients
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_auth_user_id_fkey'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- Email is used only for this one-time identity migration. Runtime policies
-- never authorize by a client-supplied email address.
update public.clients c
set auth_user_id = u.id
from auth.users u
where c.auth_user_id is null
  and u.email_confirmed_at is not null
  and lower(trim(c.email)) = lower(trim(u.email));

create unique index if not exists clients_auth_user_id_uidx
  on public.clients(auth_user_id)
  where auth_user_id is not null;

create index if not exists orders_client_id_idx on public.orders(client_id);
create index if not exists quotes_client_id_idx on public.quotes(client_id);
create index if not exists product_orders_client_id_idx on public.product_orders(client_id);

-- SECURITY DEFINER avoids recursive evaluation of clients policies. A fixed,
-- empty search_path and schema-qualified objects prevent object shadowing.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clients c
    where c.auth_user_id = (select auth.uid())
      and c.role = 'admin'
  );
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.clients c
  where c.auth_user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_client_id() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.current_client_id() to authenticated, service_role;

alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.orders enable row level security;
alter table public.products enable row level security;
alter table public.product_orders enable row level security;
alter table public.services_catalog enable row level security;

-- Remove policies with these names to keep this migration safely repeatable.
drop policy if exists clients_select_self_or_admin on public.clients;
drop policy if exists clients_insert_admin on public.clients;
drop policy if exists clients_update_admin on public.clients;
drop policy if exists clients_delete_admin on public.clients;
create policy clients_select_self_or_admin on public.clients
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.is_admin()));
create policy clients_insert_admin on public.clients
  for insert to authenticated
  with check ((select public.is_admin()));
create policy clients_update_admin on public.clients
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy clients_delete_admin on public.clients
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists quotes_select_self_or_admin on public.quotes;
drop policy if exists quotes_insert_self_or_admin on public.quotes;
drop policy if exists quotes_update_admin on public.quotes;
drop policy if exists quotes_delete_admin on public.quotes;
create policy quotes_select_self_or_admin on public.quotes
  for select to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy quotes_insert_self_or_admin on public.quotes
  for insert to authenticated
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy quotes_update_admin on public.quotes
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy quotes_delete_admin on public.quotes
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists orders_select_self_or_admin on public.orders;
drop policy if exists orders_insert_self_or_admin on public.orders;
drop policy if exists orders_update_admin on public.orders;
drop policy if exists orders_delete_admin on public.orders;
create policy orders_select_self_or_admin on public.orders
  for select to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy orders_insert_self_or_admin on public.orders
  for insert to authenticated
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy orders_update_admin on public.orders
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy orders_delete_admin on public.orders
  for delete to authenticated
  using ((select public.is_admin()));

-- Catalogue data is visible to signed-in clients; only admins manage it.
drop policy if exists products_select_authenticated on public.products;
drop policy if exists products_manage_admin on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated using (true);
create policy products_manage_admin on public.products
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists services_catalog_select_authenticated on public.services_catalog;
drop policy if exists services_catalog_manage_admin on public.services_catalog;
create policy services_catalog_select_authenticated on public.services_catalog
  for select to authenticated using (true);
create policy services_catalog_manage_admin on public.services_catalog
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists product_orders_select_self_or_admin on public.product_orders;
drop policy if exists product_orders_insert_self_or_admin on public.product_orders;
drop policy if exists product_orders_update_admin on public.product_orders;
drop policy if exists product_orders_delete_admin on public.product_orders;
create policy product_orders_select_self_or_admin on public.product_orders
  for select to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy product_orders_insert_self_or_admin on public.product_orders
  for insert to authenticated
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy product_orders_update_admin on public.product_orders
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy product_orders_delete_admin on public.product_orders
  for delete to authenticated
  using ((select public.is_admin()));

commit;
