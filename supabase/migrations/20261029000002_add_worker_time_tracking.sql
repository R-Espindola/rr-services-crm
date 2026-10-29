-- Work timer, pause accounting, and monthly time summaries.
-- The existing portal migration already adds started_at/completed_at; add them
-- defensively here as well so this migration documents the full time schema.

begin;

alter table public.orders
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists duration_minutes integer,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_duration_seconds integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_duration_minutes_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_duration_minutes_nonnegative
      check (duration_minutes is null or duration_minutes >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_paused_duration_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_paused_duration_nonnegative
      check (paused_duration_seconds >= 0);
  end if;
end $$;

-- Backfill completed historic jobs that already have both timestamps.
update public.orders
set duration_minutes = greatest(
  floor(extract(epoch from (completed_at - started_at)) / 60)::integer,
  0
)
where status = 'completed'
  and started_at is not null
  and completed_at is not null
  and duration_minutes is null;

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
   where id = p_order_id
     and worker_user_id = (select auth.uid())
     and status = 'in_progress'
     and paused_at is null
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
   where id = p_order_id
     and worker_user_id = (select auth.uid())
     and status = 'in_progress'
     and paused_at is not null
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
  v_paused_seconds integer;
  v_duration_minutes integer;
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
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
     and worker_user_id = (select auth.uid())
     and status = 'in_progress'
  returning * into v_order;

  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned active order not found';
  end if;

  v_paused_seconds := v_order.paused_duration_seconds;
  v_duration_minutes := v_order.duration_minutes;
  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'completed_at', v_order.completed_at,
    'duration_minutes', v_duration_minutes,
    'paused_duration_seconds', v_paused_seconds
  );
end;
$$;

revoke all on function public.worker_pause_cleaning(uuid) from public, anon;
revoke all on function public.worker_resume_cleaning(uuid) from public, anon;
revoke all on function public.worker_finish_cleaning(uuid) from public, anon;
grant execute on function public.worker_pause_cleaning(uuid) to authenticated;
grant execute on function public.worker_resume_cleaning(uuid) to authenticated;
grant execute on function public.worker_finish_cleaning(uuid) to authenticated;

commit;
