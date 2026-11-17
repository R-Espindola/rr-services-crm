begin;

-- Compatibilidade: o trabalhador pode iniciar a limpeza depois de marcar a deslocação.
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
     and o.status in ('pending', 'confirmed', 'en_route')
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned order not found';
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

create or replace function public.worker_mark_en_route(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_active_worker()) then
    raise exception using errcode = '42501', message = 'Active worker required';
  end if;

  update public.orders
     set status = 'en_route'
   where id = p_order_id
     and worker_user_id = (select auth.uid())
     and status = 'confirmed'
   returning * into v_order;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assigned confirmed order not found';
  end if;

  return jsonb_build_object('id', v_order.id, 'status', v_order.status);
end;
$$;

revoke all on function public.worker_mark_en_route(uuid) from public, anon;
grant execute on function public.worker_mark_en_route(uuid) to authenticated;

-- Atribuições novas devem proteger a leitura da propriedade mesmo quando o campo legado
-- worker_user_id ainda não tiver sido sincronizado.
drop policy if exists "Workers can view assigned properties" on public.properties;
create policy "Workers can view assigned properties" on public.properties
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.property_id = properties.id
        and coalesce(o.assigned_worker_id, o.worker_user_id) = (select auth.uid())
    )
  );

commit;
