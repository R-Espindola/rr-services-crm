-- Expansão do portal do cliente.
-- `orders` continua a ser a fonte de verdade das marcações existentes.
-- A API pública `bookings` é uma view de compatibilidade sobre `orders`.

begin;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,
  street_address text not null,
  postal_code text not null,
  city text not null,
  reference_notes text not null default '',
  access_instructions text not null default '',
  cleaning_notes text not null default '',
  company_provides_supplies boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_label_length check (length(btrim(label)) between 1 and 120),
  constraint properties_postal_code_pt_check check (postal_code ~ '^[0-9]{4}-[0-9]{3}$'),
  constraint properties_text_lengths check (
    length(street_address) <= 300 and length(city) <= 120
    and length(reference_notes) <= 1000 and length(access_instructions) <= 2000
    and length(cleaning_notes) <= 2000
  )
);

create index if not exists properties_client_active_idx on public.properties(client_id, is_active);

create table if not exists public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  service_type_id uuid references public.services_catalog(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  preferred_weekday smallint check (preferred_weekday between 0 and 6),
  preferred_start_time time without time zone,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  paused_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_schedules_client_status_idx
  on public.recurring_schedules(client_id, status);

alter table public.orders
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists recurring_schedule_id uuid references public.recurring_schedules(id) on delete set null,
  add column if not exists assigned_worker_id uuid references public.worker_profiles(user_id) on delete set null,
  add column if not exists arrival_window_start time without time zone,
  add column if not exists arrival_window_end time without time zone,
  add column if not exists client_notes text not null default '',
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists late_cancellation_fee_applied boolean not null default false;

create or replace function public.sync_order_worker_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_worker_id is distinct from old.assigned_worker_id
     and new.worker_user_id is not distinct from old.worker_user_id then
    new.worker_user_id := new.assigned_worker_id;
  elsif new.worker_user_id is distinct from old.worker_user_id
     and new.assigned_worker_id is not distinct from old.assigned_worker_id then
    new.assigned_worker_id := new.worker_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_sync_worker_assignment on public.orders;
create trigger orders_sync_worker_assignment
before update on public.orders
for each row execute function public.sync_order_worker_assignment();

update public.orders
set assigned_worker_id = worker_user_id
where assigned_worker_id is null and worker_user_id is not null;

create or replace view public.bookings
with (security_invoker = true)
as
select
  o.id,
  o.client_id,
  o.property_id,
  o.recurring_schedule_id,
  coalesce(o.assigned_worker_id, o.worker_user_id) as assigned_worker_id,
  o.service_type,
  o.scheduled_date,
  o.arrival_window_start,
  o.arrival_window_end,
  o.status,
  o.total_amount,
  o.client_notes,
  o.cancellation_reason,
  o.cancelled_at,
  o.late_cancellation_fee_applied,
  o.created_at
from public.orders o;

grant select on public.bookings to authenticated;

create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.orders(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  has_issue boolean not null default false,
  issue_description text not null default '',
  issue_photo_urls text[] not null default array[]::text[],
  issue_status text not null default 'open' check (issue_status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  constraint booking_reviews_text_lengths check (length(comment) <= 2000 and length(issue_description) <= 3000),
  constraint booking_reviews_issue_check check (has_issue or (issue_description = '' and cardinality(issue_photo_urls) = 0))
);

create index if not exists booking_reviews_client_idx on public.booking_reviews(client_id, created_at desc);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid unique references public.clients(id) on delete set null,
  gdpr_accepted_at timestamptz,
  marketing_consent boolean not null default false,
  notification_preferences jsonb not null default '{"email": true, "whatsapp": true, "sms": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_notification_preferences_object check (jsonb_typeof(notification_preferences) = 'object')
);

create or replace function public.client_has_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_booking_id and o.client_id = (select public.current_client_id())
  );
$$;

revoke all on function public.client_has_booking(uuid) from public, anon;
grant execute on function public.client_has_booking(uuid) to authenticated, service_role;

alter table public.properties enable row level security;
alter table public.recurring_schedules enable row level security;
alter table public.booking_reviews enable row level security;
alter table public.profiles enable row level security;

drop policy if exists properties_client_select on public.properties;
drop policy if exists properties_client_insert on public.properties;
drop policy if exists properties_client_update on public.properties;
drop policy if exists properties_client_delete on public.properties;
create policy properties_client_select on public.properties for select to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin())
    or exists (select 1 from public.orders o where o.property_id = properties.id and o.worker_user_id = (select auth.uid())));
create policy properties_client_insert on public.properties for insert to authenticated
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy properties_client_update on public.properties for update to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()))
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy properties_client_delete on public.properties for delete to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()));

drop policy if exists recurring_schedules_client_select on public.recurring_schedules;
drop policy if exists recurring_schedules_client_insert on public.recurring_schedules;
drop policy if exists recurring_schedules_client_update on public.recurring_schedules;
drop policy if exists recurring_schedules_client_delete on public.recurring_schedules;
create policy recurring_schedules_client_select on public.recurring_schedules for select to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy recurring_schedules_client_insert on public.recurring_schedules for insert to authenticated
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy recurring_schedules_client_update on public.recurring_schedules for update to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()))
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));
create policy recurring_schedules_client_delete on public.recurring_schedules for delete to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()));

drop policy if exists booking_reviews_client_select on public.booking_reviews;
drop policy if exists booking_reviews_client_insert on public.booking_reviews;
drop policy if exists booking_reviews_client_update on public.booking_reviews;
create policy booking_reviews_client_select on public.booking_reviews for select to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin())
    or (select private.worker_can_access_client(client_id)));
create policy booking_reviews_client_insert on public.booking_reviews for insert to authenticated
  with check (client_id = (select public.current_client_id()) and (select public.client_has_booking(booking_id)));
create policy booking_reviews_client_update on public.booking_reviews for update to authenticated
  using (client_id = (select public.current_client_id()) or (select public.is_admin()))
  with check (client_id = (select public.current_client_id()) or (select public.is_admin()));

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.recurring_schedules to authenticated;
grant select, insert, update on public.booking_reviews to authenticated;
grant select, insert, update on public.profiles to authenticated;

create or replace function public.client_reschedule_order(p_order_id uuid, p_scheduled_date timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
  where id = p_order_id and client_id = (select public.current_client_id())
    and status in ('pending', 'confirmed') for update;
  if not found then raise exception using message = 'Booking not found or not reschedulable'; end if;
  if p_scheduled_date <= clock_timestamp() then raise exception using message = 'Scheduled date must be in the future'; end if;
  if v_order.scheduled_date is not null and v_order.scheduled_date - clock_timestamp() < interval '24 hours' then
    raise exception using message = 'Changes require at least 24 hours';
  end if;
  update public.orders set scheduled_date = p_scheduled_date where id = p_order_id;
  return jsonb_build_object('id', p_order_id, 'scheduled_date', p_scheduled_date);
end;
$$;

create or replace function public.client_cancel_order(p_order_id uuid, p_reason text, p_confirm_late boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_late boolean := false;
begin
  select * into v_order from public.orders
  where id = p_order_id and client_id = (select public.current_client_id())
    and status in ('pending', 'confirmed') for update;
  if not found then raise exception using message = 'Booking not found or not cancellable'; end if;
  v_late := v_order.scheduled_date is not null and v_order.scheduled_date - clock_timestamp() < interval '24 hours';
  if v_late and not p_confirm_late then raise exception using message = 'late cancellation confirmation required'; end if;
  update public.orders set status = 'cancelled', cancellation_reason = left(coalesce(p_reason, ''), 1000),
    cancelled_at = clock_timestamp(), late_cancellation_fee_applied = v_late where id = p_order_id;
  return jsonb_build_object('id', p_order_id, 'late_fee_applied', v_late);
end;
$$;

revoke all on function public.client_reschedule_order(uuid, timestamptz) from public, anon;
revoke all on function public.client_cancel_order(uuid, text, boolean) from public, anon;
grant execute on function public.client_reschedule_order(uuid, timestamptz) to authenticated;
grant execute on function public.client_cancel_order(uuid, text, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-issues', 'booking-issues', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists booking_issues_client_select on storage.objects;
drop policy if exists booking_issues_client_insert on storage.objects;
drop policy if exists booking_issues_admin_select on storage.objects;
create policy booking_issues_client_select on storage.objects for select to authenticated
  using (bucket_id = 'booking-issues'
    and (storage.foldername(name))[1] = (select public.current_client_id())::text);
create policy booking_issues_client_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'booking-issues'
    and (storage.foldername(name))[1] = (select public.current_client_id())::text);
create policy booking_issues_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'booking-issues' and (select public.is_admin()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

commit;

