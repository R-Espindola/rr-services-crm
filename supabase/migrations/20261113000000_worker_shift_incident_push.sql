begin;

alter table public.orders
  add column if not exists incident_photos text[] not null default array[]::text[];

create table if not exists public.worker_shifts (
  id uuid primary key default gen_random_uuid(),
  worker_user_id uuid not null references public.worker_profiles(user_id) on delete cascade,
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  break_started_at timestamptz,
  break_duration_seconds integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  constraint worker_shifts_break_duration_nonnegative check (break_duration_seconds >= 0),
  constraint worker_shifts_valid_end check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists worker_shifts_one_active_per_worker_idx
  on public.worker_shifts(worker_user_id)
  where ended_at is null;

create index if not exists worker_shifts_worker_started_idx
  on public.worker_shifts(worker_user_id, started_at desc);

alter table public.worker_shifts enable row level security;
revoke all on public.worker_shifts from public, anon, authenticated;
grant select on public.worker_shifts to authenticated;

drop policy if exists worker_shifts_select_own on public.worker_shifts;
create policy worker_shifts_select_own on public.worker_shifts
  for select to authenticated
  using (worker_user_id = (select auth.uid()) and (select private.is_active_worker()));

create table if not exists public.worker_push_subscriptions (
  endpoint text primary key,
  worker_user_id uuid not null references public.worker_profiles(user_id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint worker_push_endpoint_length check (length(endpoint) between 1 and 2048),
  constraint worker_push_subscription_object check (jsonb_typeof(subscription) = 'object')
);

create index if not exists worker_push_subscriptions_worker_idx
  on public.worker_push_subscriptions(worker_user_id);

alter table public.worker_push_subscriptions enable row level security;
revoke all on public.worker_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.worker_push_subscriptions to authenticated;
grant select, delete on public.worker_push_subscriptions to service_role;

drop policy if exists worker_push_subscriptions_select_own on public.worker_push_subscriptions;
drop policy if exists worker_push_subscriptions_insert_own on public.worker_push_subscriptions;
drop policy if exists worker_push_subscriptions_update_own on public.worker_push_subscriptions;
drop policy if exists worker_push_subscriptions_delete_own on public.worker_push_subscriptions;
create policy worker_push_subscriptions_select_own on public.worker_push_subscriptions
  for select to authenticated
  using (worker_user_id = (select auth.uid()) and (select private.is_active_worker()));
create policy worker_push_subscriptions_insert_own on public.worker_push_subscriptions
  for insert to authenticated
  with check (worker_user_id = (select auth.uid()) and (select private.is_active_worker()));
create policy worker_push_subscriptions_update_own on public.worker_push_subscriptions
  for update to authenticated
  using (worker_user_id = (select auth.uid()) and (select private.is_active_worker()))
  with check (worker_user_id = (select auth.uid()) and (select private.is_active_worker()));
create policy worker_push_subscriptions_delete_own on public.worker_push_subscriptions
  for delete to authenticated
  using (worker_user_id = (select auth.uid()) and (select private.is_active_worker()));

drop policy if exists worker_photos_select_admin on storage.objects;
create policy worker_photos_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'worker-cleaning-photos' and (select public.is_admin()));

create or replace function public.worker_start_shift()
returns public.worker_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare v_shift public.worker_shifts%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  insert into public.worker_shifts(worker_user_id)
  values ((select auth.uid()))
  returning * into v_shift;

  return v_shift;
end;
$$;

create or replace function public.worker_pause_shift()
returns public.worker_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare v_shift public.worker_shifts%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  update public.worker_shifts
     set break_started_at = clock_timestamp()
   where worker_user_id = (select auth.uid())
     and ended_at is null
     and break_started_at is null
  returning * into v_shift;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active shift without a break not found';
  end if;
  return v_shift;
end;
$$;

create or replace function public.worker_resume_shift()
returns public.worker_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.worker_shifts%rowtype;
  v_resumed_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  update public.worker_shifts
     set break_duration_seconds = break_duration_seconds
           + greatest(floor(extract(epoch from (v_resumed_at - break_started_at)))::integer, 0),
         break_started_at = null
   where worker_user_id = (select auth.uid())
     and ended_at is null
     and break_started_at is not null
  returning * into v_shift;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active shift break not found';
  end if;
  return v_shift;
end;
$$;

create or replace function public.worker_finish_shift()
returns public.worker_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.worker_shifts%rowtype;
  v_ended_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  update public.worker_shifts
     set ended_at = v_ended_at,
         break_duration_seconds = break_duration_seconds + case
           when break_started_at is not null
             then greatest(floor(extract(epoch from (v_ended_at - break_started_at)))::integer, 0)
           else 0
         end,
         break_started_at = null
   where worker_user_id = (select auth.uid())
     and ended_at is null
  returning * into v_shift;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active shift not found';
  end if;
  return v_shift;
end;
$$;

revoke all on function public.worker_start_shift() from public, anon;
revoke all on function public.worker_pause_shift() from public, anon;
revoke all on function public.worker_resume_shift() from public, anon;
revoke all on function public.worker_finish_shift() from public, anon;
grant execute on function public.worker_start_shift() to authenticated;
grant execute on function public.worker_pause_shift() to authenticated;
grant execute on function public.worker_resume_shift() to authenticated;
grant execute on function public.worker_finish_shift() to authenticated;

create or replace function public.worker_attach_photo(
  p_order_id uuid,
  p_photo_type text,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_incident_photo_count integer;
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;
  if p_order_id is null
     or p_photo_type is null
     or p_photo_type not in ('before', 'after', 'incident')
     or p_storage_path is null
     or length(p_storage_path) > 500
     or p_storage_path not like (select auth.uid())::text || '/' || p_order_id::text || '/' || p_photo_type || '/%' then
    raise exception using errcode = '22023', message = 'Invalid photo path';
  end if;

  select o.status, cardinality(o.incident_photos)
    into v_status, v_incident_photo_count
    from public.orders o
   where o.id = p_order_id and o.worker_user_id = (select auth.uid())
   for update;
  if not found
     or (p_photo_type = 'before' and v_status not in ('pending', 'in_progress'))
     or (p_photo_type = 'after' and v_status not in ('in_progress', 'completed'))
     or (p_photo_type = 'incident' and v_status <> 'in_progress') then
    raise exception using errcode = 'P0002', message = 'Assigned order or photo state invalid';
  end if;
  if p_photo_type = 'incident' and v_incident_photo_count >= 10 then
    raise exception using errcode = '22023', message = 'Incident photo limit reached';
  end if;

  if p_photo_type = 'before' then
    update public.orders set before_photos = array_append(before_photos, p_storage_path)
     where id = p_order_id and worker_user_id = (select auth.uid());
  elsif p_photo_type = 'after' then
    update public.orders set after_photos = array_append(after_photos, p_storage_path)
     where id = p_order_id and worker_user_id = (select auth.uid());
  else
    update public.orders set incident_photos = array_append(incident_photos, p_storage_path)
     where id = p_order_id and worker_user_id = (select auth.uid());
  end if;

  return jsonb_build_object('saved', true, 'storage_path', p_storage_path);
end;
$$;

revoke all on function public.worker_attach_photo(uuid, text, text) from public, anon;
grant execute on function public.worker_attach_photo(uuid, text, text) to authenticated;

commit;
