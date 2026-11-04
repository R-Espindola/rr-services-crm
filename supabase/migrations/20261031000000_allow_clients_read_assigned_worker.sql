-- Permite que um cliente consulte apenas o nome do trabalhador atribuído
-- às suas próprias marcações. A política não abre a lista de trabalhadores.
begin;

drop policy if exists worker_profiles_select_assigned_client
  on public.worker_profiles;

create policy worker_profiles_select_assigned_client
  on public.worker_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders as order_row
      where order_row.worker_user_id = worker_profiles.user_id
        and order_row.client_id = (select public.current_client_id())
    )
  );

commit;
