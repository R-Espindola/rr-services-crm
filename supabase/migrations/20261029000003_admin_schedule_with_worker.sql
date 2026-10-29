-- Keep orders protected from direct client INSERTs. Admin appointments are
-- created through a narrow RPC that verifies the caller and validates worker
-- assignment. The optional worker and time-tracking fields remain nullable.

begin;

alter table public.orders
  alter column worker_user_id drop not null,
  alter column started_at drop not null,
  alter column completed_at drop not null;

create or replace function public.admin_criar_agendamento_com_funcionario_seguro(
  p_client_id uuid,
  p_service_type text,
  p_scheduled_date timestamptz,
  p_total_amount numeric,
  p_notes text default null,
  p_worker_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  if p_client_id is null
     or p_service_type is null
     or length(trim(p_service_type)) not between 1 and 200
     or p_scheduled_date is null
     or p_total_amount is null
     or p_total_amount < 0
     or (p_notes is not null and length(p_notes) > 2000) then
    raise exception using errcode = '22023', message = 'Invalid appointment';
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id) then
    raise exception using errcode = '22023', message = 'Invalid client';
  end if;

  if p_worker_user_id is not null and not exists (
    select 1 from public.worker_profiles wp
    where wp.user_id = p_worker_user_id and wp.active is true
  ) then
    raise exception using errcode = '22023', message = 'Invalid or inactive worker';
  end if;

  insert into public.orders (
    client_id, service_type, scheduled_date, total_amount, status, notes, worker_user_id
  ) values (
    p_client_id, trim(p_service_type), p_scheduled_date, p_total_amount,
    'pending', p_notes, p_worker_user_id
  )
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'worker_user_id', v_order.worker_user_id
  );
end;
$$;

revoke all on function public.admin_criar_agendamento_com_funcionario_seguro(uuid, text, timestamptz, numeric, text, uuid) from public, anon;
grant execute on function public.admin_criar_agendamento_com_funcionario_seguro(uuid, text, timestamptz, numeric, text, uuid) to authenticated;

commit;
