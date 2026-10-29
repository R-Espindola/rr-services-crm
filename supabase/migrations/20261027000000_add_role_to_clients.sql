-- Supabase CLI migration equivalent of the legacy database/migrations/001 file.
-- IF NOT EXISTS makes this safe for databases where the legacy migration ran.
alter table public.clients
  add column if not exists role text not null default 'client';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_role_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_role_check check (role in ('admin', 'client'));
  end if;
end $$;

create index if not exists idx_clients_role on public.clients(role);
create index if not exists idx_clients_email on public.clients(email);
