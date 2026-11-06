begin;

drop function if exists public.worker_start_cleaning(uuid, double precision, double precision, double precision);
drop function if exists public.worker_pause_cleaning(uuid, double precision, double precision, double precision);
drop function if exists public.worker_resume_cleaning(uuid, double precision, double precision, double precision);
drop function if exists public.worker_finish_cleaning(uuid, double precision, double precision, double precision);
drop function if exists private.worker_location_matches(uuid, double precision, double precision, double precision);

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
  if v_order.scheduled_date > v_started_at + interval '5 minutes' then
    raise exception using errcode = '42501', message = 'start window opens 5 minutes before scheduled time';
  end if;

  update public.orders
     set status = 'in_progress', started_at = v_started_at
   where id = p_order_id
   returning * into v_order;

  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'started_at', v_order.started_at);
end;
$$;

create or replace function public.worker_pause_cleaning(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  update public.orders
     set paused_at = clock_timestamp()
   where id = p_order_id and worker_user_id = (select auth.uid())
     and status = 'in_progress' and paused_at is null
  returning * into v_order;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned running order not found';
  end if;
  return jsonb_build_object('id', v_order.id, 'paused_at', v_order.paused_at);
end;
$$;

create or replace function public.worker_resume_cleaning(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_resumed_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  update public.orders
     set paused_duration_seconds = paused_duration_seconds + greatest(
           floor(extract(epoch from (v_resumed_at - paused_at)))::integer, 0
         ),
         paused_at = null
   where id = p_order_id and worker_user_id = (select auth.uid())
     and status = 'in_progress' and paused_at is not null
  returning * into v_order;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned paused order not found';
  end if;
  return jsonb_build_object('id', v_order.id, 'paused_duration_seconds', v_order.paused_duration_seconds);
end;
$$;

create or replace function public.worker_finish_cleaning(p_order_id uuid)
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
   where o.id = p_order_id and o.worker_user_id = (select auth.uid())
     and o.status = 'in_progress'
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned active order not found';
  end if;
  if jsonb_typeof(v_order.worker_checklist) is distinct from 'array' then
    raise exception using errcode = '42501', message = 'Checklist has pending tasks';
  end if;
  if jsonb_array_length(v_order.worker_checklist) = 0 or exists (
       select 1 from jsonb_array_elements(v_order.worker_checklist) item
       where item->'done' is distinct from 'true'::jsonb
     ) then
    raise exception using errcode = '42501', message = 'Checklist has pending tasks';
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
revoke all on function public.worker_pause_cleaning(uuid) from public, anon;
revoke all on function public.worker_resume_cleaning(uuid) from public, anon;
revoke all on function public.worker_finish_cleaning(uuid) from public, anon;
grant execute on function public.worker_start_cleaning(uuid) to authenticated;
grant execute on function public.worker_pause_cleaning(uuid) to authenticated;
grant execute on function public.worker_resume_cleaning(uuid) to authenticated;
grant execute on function public.worker_finish_cleaning(uuid) to authenticated;

commit;
