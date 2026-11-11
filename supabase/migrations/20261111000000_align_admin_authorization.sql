-- Keep route guards, server actions, and RLS on the same admin rule.
-- The project stores client roles in public.clients (there is no public.profiles table).
-- Preserve the existing verified owner account as an admin even when its client
-- row is missing or its role was not migrated yet.
begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.clients c
      where c.auth_user_id = (select auth.uid())
        and c.role = 'admin'
    )
    or exists (
      select 1
      from auth.users u
      where u.id = (select auth.uid())
        and u.email_confirmed_at is not null
        and lower(u.email) = 'rrservices.pt@gmail.com'
    );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

commit;
