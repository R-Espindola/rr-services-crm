-- Enforce the five-minute early-start window in the database and ensure the
-- worker checklist/time columns exist for environments with partial history.
begin;

alter table public.orders
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists duration_minutes integer,
  add column if not exists worker_checklist jsonb not null default '[]'::jsonb;

alter table public.orders
  alter column started_at drop not null,
  alter column completed_at drop not null;

comment on column public.orders.worker_checklist is
  'Per-order checklist, including worker-added tasks; item schema is validated by worker_save_checklist.';

create or replace function public.worker_start_cleaning(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_started_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  -- Lock the assigned row so concurrent calls cannot both start it.
  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
     and o.worker_user_id = (select auth.uid())
     and o.status = 'pending'
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned pending order not found';
  end if;

  if v_order.scheduled_date is null
     or v_order.scheduled_date > v_started_at + interval '5 minutes' then
    raise exception using errcode = '42501', message = 'start window opens 5 minutes before scheduled time';
  end if;

  update public.orders
     set status = 'in_progress', started_at = v_started_at
   where id = p_order_id
   returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'started_at', v_order.started_at
  );
end;
$$;

revoke all on function public.worker_start_cleaning(uuid) from public, anon;
grant execute on function public.worker_start_cleaning(uuid) to authenticated;

commit;
