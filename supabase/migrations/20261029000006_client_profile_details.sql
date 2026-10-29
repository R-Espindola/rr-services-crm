-- Client profile fields and least-privilege self-service profile editing.
begin;

alter table public.clients
  add column if not exists postal_code text,
  add column if not exists locality text,
  add column if not exists birth_date date;

comment on column public.clients.birth_date is
  'Optional date of birth supplied by the client for birthday offers.';

-- Clients may update only their contact/profile fields. In particular, they
-- cannot change role, auth_user_id, account status, or administrative fields.
revoke update on table public.clients from authenticated;
grant update (name, email, phone, address, postal_code, locality, birth_date)
  on table public.clients to authenticated;

drop policy if exists clients_update_self_profile on public.clients;
create policy clients_update_self_profile on public.clients
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

commit;
