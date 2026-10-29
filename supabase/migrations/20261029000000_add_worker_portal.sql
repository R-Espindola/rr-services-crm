-- Worker portal foundation: assignments, work timestamps, checklist and photos.
-- Orders stay read-only to workers through direct table access; mutations go
-- through narrowly scoped RPCs that verify auth.uid() against the assignment.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.worker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint worker_profiles_display_name_length check (length(trim(display_name)) between 1 and 120)
);

grant select, insert, update, delete on public.worker_profiles to authenticated;
alter table public.worker_profiles enable row level security;

alter table public.orders
  add column if not exists worker_user_id uuid references public.worker_profiles(user_id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists worker_checklist jsonb not null default '[]'::jsonb,
  add column if not exists before_photos text[] not null default array[]::text[],
  add column if not exists after_photos text[] not null default array[]::text[];

create index if not exists orders_worker_day_idx
  on public.orders(worker_user_id, scheduled_date);

create or replace function private.is_active_worker()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.worker_profiles wp
    where wp.user_id = (select auth.uid()) and wp.active is true
  );
$$;

create or replace function private.worker_can_access_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.worker_profiles wp
    join public.orders o on o.worker_user_id = wp.user_id
    where wp.user_id = (select auth.uid())
      and wp.active is true
      and o.client_id = p_client_id
  );
$$;

revoke all on function private.is_active_worker() from public, anon;
revoke all on function private.worker_can_access_client(uuid) from public, anon;
grant execute on function private.is_active_worker() to authenticated;
grant execute on function private.worker_can_access_client(uuid) to authenticated;

drop policy if exists worker_profiles_select_self_or_admin on public.worker_profiles;
drop policy if exists worker_profiles_insert_admin on public.worker_profiles;
drop policy if exists worker_profiles_update_admin on public.worker_profiles;
drop policy if exists worker_profiles_delete_admin on public.worker_profiles;
create policy worker_profiles_select_self_or_admin on public.worker_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy worker_profiles_insert_admin on public.worker_profiles
  for insert to authenticated
  with check ((select public.is_admin()));
create policy worker_profiles_update_admin on public.worker_profiles
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy worker_profiles_delete_admin on public.worker_profiles
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists orders_select_assigned_worker on public.orders;
create policy orders_select_assigned_worker on public.orders
  for select to authenticated
  using (worker_user_id = (select auth.uid()) and (select private.is_active_worker()));

drop policy if exists clients_select_assigned_worker on public.clients;
create policy clients_select_assigned_worker on public.clients
  for select to authenticated
  using ((select private.worker_can_access_client(id)));

-- Private bucket: each worker can upload and read only within their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-cleaning-photos', 'worker-cleaning-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists worker_photos_select_own on storage.objects;
drop policy if exists worker_photos_insert_own on storage.objects;
create policy worker_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'worker-cleaning-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_worker())
  );
create policy worker_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'worker-cleaning-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_worker())
  );

-- RPCs are exposed through public for PostgREST, but callable only by
-- authenticated users and each function rechecks the assigned worker identity.
create or replace function public.worker_start_cleaning(p_order_id uuid)
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
     set status = 'in_progress', started_at = coalesce(started_at, now())
   where id = p_order_id and worker_user_id = (select auth.uid()) and status = 'pending'
  returning * into v_order;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned pending order not found';
  end if;
  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'started_at', v_order.started_at);
end;
$$;

create or replace function public.worker_finish_cleaning(p_order_id uuid)
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
     set status = 'completed', completed_at = coalesce(completed_at, now())
   where id = p_order_id and worker_user_id = (select auth.uid()) and status = 'in_progress'
  returning * into v_order;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned active order not found';
  end if;
  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'completed_at', v_order.completed_at);
end;
$$;

create or replace function public.worker_save_checklist(p_order_id uuid, p_checklist jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'array' or jsonb_array_length(p_checklist) > 50 then
    raise exception using errcode = '22023', message = 'Invalid checklist';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_checklist) item
    where jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item->'id') is distinct from 'string'
       or jsonb_typeof(item->'label') is distinct from 'string'
       or jsonb_typeof(item->'done') is distinct from 'boolean'
       or length(item->>'id') not between 1 and 80
       or length(btrim(item->>'label')) not between 1 and 240
  ) then
    raise exception using errcode = '22023', message = 'Invalid checklist item';
  end if;
  update public.orders set worker_checklist = p_checklist
   where id = p_order_id and worker_user_id = (select auth.uid()) and status in ('pending', 'in_progress');
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned editable order not found';
  end if;
  return jsonb_build_object('saved', true);
end;
$$;

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
declare v_status text;
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;
  if p_order_id is null
     or p_photo_type is null
     or p_photo_type not in ('before', 'after')
     or p_storage_path is null
     or length(p_storage_path) > 500
     or p_storage_path not like (select auth.uid())::text || '/' || p_order_id::text || '/' || p_photo_type || '/%' then
    raise exception using errcode = '22023', message = 'Invalid photo path';
  end if;

  select o.status into v_status from public.orders o
   where o.id = p_order_id and o.worker_user_id = (select auth.uid());
  if not found or (p_photo_type = 'before' and v_status not in ('pending', 'in_progress'))
     or (p_photo_type = 'after' and v_status not in ('in_progress', 'completed')) then
    raise exception using errcode = 'P0002', message = 'Assigned order or photo state invalid';
  end if;

  if p_photo_type = 'before' then
    update public.orders set before_photos = array_append(before_photos, p_storage_path)
     where id = p_order_id and worker_user_id = (select auth.uid());
  else
    update public.orders set after_photos = array_append(after_photos, p_storage_path)
     where id = p_order_id and worker_user_id = (select auth.uid());
  end if;
  return jsonb_build_object('saved', true, 'storage_path', p_storage_path);
end;
$$;

revoke all on function public.worker_start_cleaning(uuid) from public, anon;
revoke all on function public.worker_finish_cleaning(uuid) from public, anon;
revoke all on function public.worker_save_checklist(uuid, jsonb) from public, anon;
revoke all on function public.worker_attach_photo(uuid, text, text) from public, anon;
grant execute on function public.worker_start_cleaning(uuid) to authenticated;
grant execute on function public.worker_finish_cleaning(uuid) to authenticated;
grant execute on function public.worker_save_checklist(uuid, jsonb) to authenticated;
grant execute on function public.worker_attach_photo(uuid, text, text) to authenticated;

commit;
