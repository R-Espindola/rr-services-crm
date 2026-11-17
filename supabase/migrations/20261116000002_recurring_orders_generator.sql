begin;

alter table public.recurring_schedules
  add column if not exists next_generation_date date not null default current_date,
  add column if not exists preferred_end_time time without time zone;

alter table public.orders
  add column if not exists service_type_id uuid references public.services_catalog(id) on delete set null;

create index if not exists recurring_schedules_generation_idx
  on public.recurring_schedules(status, next_generation_date);

create unique index if not exists orders_recurring_schedule_date_unique_idx
  on public.orders(recurring_schedule_id, scheduled_date)
  where recurring_schedule_id is not null;

create or replace function public.generate_due_recurring_orders()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_schedule record;
  v_property record;
  v_generation_date date;
  v_created integer := 0;
  v_notes text;
begin
  if (select auth.uid()) is not null and not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Admin required';
  end if;

  for v_schedule in
    select rs.* from public.recurring_schedules rs
     where rs.status = 'active'
       and (rs.paused_until is null or rs.paused_until <= current_date)
       and rs.next_generation_date <= current_date + 14
     order by rs.next_generation_date, rs.created_at
  loop
    select p.* into v_property from public.properties p
     where p.id = v_schedule.property_id and p.is_active is true;
    if not found then continue; end if;

    v_generation_date := v_schedule.next_generation_date;
    while v_generation_date <= current_date + 14 loop
      v_notes := concat_ws(E'\n', nullif(trim(v_property.access_instructions), ''), nullif(trim(v_property.cleaning_notes), ''));
      insert into public.orders (client_id, property_id, recurring_schedule_id, service_type_id, service_type, scheduled_date, arrival_window_start, arrival_window_end, status, notes, client_notes)
      values (
        v_schedule.client_id, v_schedule.property_id, v_schedule.id, v_schedule.service_type_id,
        'Limpeza recorrente',
        (v_generation_date + coalesce(v_schedule.preferred_start_time, time '09:00')) at time zone 'Europe/Lisbon',
        v_schedule.preferred_start_time,
        coalesce(v_schedule.preferred_end_time, case when v_schedule.preferred_start_time is null then null else v_schedule.preferred_start_time + interval '30 minutes' end),
        'pending', v_notes, coalesce(v_notes, '')
      ) on conflict do nothing;
      if found then v_created := v_created + 1; end if;
      v_generation_date := case v_schedule.frequency
        when 'weekly' then v_generation_date + 7
        when 'biweekly' then v_generation_date + 14
        when 'monthly' then (v_generation_date + interval '1 month')::date
        else v_generation_date + 7
      end;
    end loop;
    update public.recurring_schedules set next_generation_date = v_generation_date, updated_at = now() where id = v_schedule.id;
  end loop;
  return v_created;
end;
$$;

revoke all on function public.generate_due_recurring_orders() from public, anon;
grant execute on function public.generate_due_recurring_orders() to authenticated;

-- Ativar apenas se a extensão pg_cron estiver disponível no projeto Supabase:
-- select cron.schedule('rr-generate-due-recurring-orders', '0 3 * * *', $$select public.generate_due_recurring_orders();$$);

commit;
