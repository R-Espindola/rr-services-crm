begin;

alter table public.orders
  add column if not exists worker_notes text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_worker_notes_length'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_worker_notes_length
      check (length(worker_notes) <= 2000);
  end if;
end $$;

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

  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
     and o.worker_user_id = (select auth.uid())
     and o.status = 'pending'
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned pending order not found';
  end if;
  if v_order.scheduled_date > v_started_at + interval '10 minutes' then
    raise exception using errcode = '42501', message = 'start window opens 10 minutes before scheduled time';
  end if;

  update public.orders
     set status = 'in_progress', started_at = v_started_at
   where id = p_order_id
   returning * into v_order;

  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'started_at', v_order.started_at);
end;
$$;

create or replace function public.worker_save_incident_notes(p_order_id uuid, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notes text := coalesce(p_notes, '');
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;
  if length(v_notes) > 2000 then
    raise exception using errcode = '22023', message = 'Incident notes are too long';
  end if;

  update public.orders
     set worker_notes = btrim(v_notes)
   where id = p_order_id
     and worker_user_id = (select auth.uid())
     and status in ('pending', 'in_progress');
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned editable order not found';
  end if;

  return jsonb_build_object('saved', true);
end;
$$;

-- PostgreSQL cannot change a function's return type with CREATE OR REPLACE.
-- Drop the one-argument version first so this migration also upgrades older
-- deployments whose RPC returned a different type.
drop function if exists public.worker_finish_cleaning(uuid);

create function public.worker_finish_cleaning(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_completed_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  select o.* into v_order from public.orders o
   where o.id = p_order_id
     and o.worker_user_id = (select auth.uid())
     and o.status = 'in_progress'
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned active order not found';
  end if;

  update public.orders
     set paused_duration_seconds = paused_duration_seconds + case
           when paused_at is not null then greatest(floor(extract(epoch from (v_completed_at - paused_at)))::integer, 0)
           else 0
         end,
         completed_at = v_completed_at,
         duration_minutes = case
           when started_at is null then 0
           else greatest(floor((
             extract(epoch from (v_completed_at - started_at))
             - paused_duration_seconds
             - case when paused_at is not null then extract(epoch from (v_completed_at - paused_at)) else 0 end
           ) / 60)::integer, 0)
         end,
         paused_at = null,
         status = 'completed'
   where id = p_order_id
   returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'completed_at', v_order.completed_at,
    'duration_minutes', v_order.duration_minutes,
    'paused_duration_seconds', v_order.paused_duration_seconds
  );
end;
$$;

revoke all on function public.worker_start_cleaning(uuid) from public, anon;
revoke all on function public.worker_save_incident_notes(uuid, text) from public, anon;
revoke all on function public.worker_finish_cleaning(uuid) from public, anon;
grant execute on function public.worker_start_cleaning(uuid) to authenticated;
grant execute on function public.worker_save_incident_notes(uuid, text) to authenticated;
grant execute on function public.worker_finish_cleaning(uuid) to authenticated;

commit;
