-- Bulk appointment creation for the admin scheduling modal.
-- Calendar dates and wall-clock time are preserved in Europe/Lisbon.

begin;

create or replace function public.admin_criar_agendamentos_recorrentes(
  p_client_id uuid,
  p_service_type text,
  p_start_date date,
  p_start_time time without time zone,
  p_total_amount numeric,
  p_notes text,
  p_worker_user_id uuid,
  p_frequency text,
  p_occurrences integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interval_days integer;
  v_created_count integer;
  v_ids jsonb;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  if p_client_id is null
     or p_service_type is null
     or length(trim(p_service_type)) not between 1 and 200
     or p_start_date is null
     or p_start_time is null
     or p_total_amount is null
     or p_total_amount < 0
     or p_frequency is null
     or p_occurrences is null
     or (p_notes is not null and length(p_notes) > 2000)
     or p_frequency not in ('once', 'weekly', 'biweekly') then
    raise exception using errcode = '22023', message = 'Invalid appointment data';
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

  if p_frequency = 'once' then
    if p_occurrences <> 1 then
      raise exception using errcode = '22023', message = 'Single appointment must have one occurrence';
    end if;
    v_interval_days := 0;
  elsif p_frequency = 'weekly' then
    if p_occurrences not between 2 and 6 then
      raise exception using errcode = '22023', message = 'Weekly appointments must have 2 to 6 occurrences';
    end if;
    v_interval_days := 7;
  else
    if p_occurrences not between 2 and 6 then
      raise exception using errcode = '22023', message = 'Fortnightly appointments must have 2 to 6 occurrences';
    end if;
    v_interval_days := 14;
  end if;

  with inserted as (
    insert into public.orders (
      client_id, service_type, scheduled_date, total_amount, status, notes, worker_user_id
    )
    select
      p_client_id,
      trim(p_service_type),
      (p_start_date + (sequence_number * v_interval_days) + p_start_time) at time zone 'Europe/Lisbon',
      p_total_amount,
      'pending',
      p_notes,
      p_worker_user_id
    from generate_series(0, p_occurrences - 1) as series(sequence_number)
    returning id
  )
  select count(*)::integer, coalesce(jsonb_agg(id), '[]'::jsonb)
    into v_created_count, v_ids
    from inserted;

  return jsonb_build_object('count', v_created_count, 'ids', v_ids);
end;
$$;

revoke all on function public.admin_criar_agendamentos_recorrentes(uuid, text, date, time without time zone, numeric, text, uuid, text, integer) from public, anon;
grant execute on function public.admin_criar_agendamentos_recorrentes(uuid, text, date, time without time zone, numeric, text, uuid, text, integer) to authenticated;

commit;
