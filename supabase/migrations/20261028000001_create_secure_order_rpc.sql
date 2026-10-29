-- Secure order creation. Prices, names, owner and initial status are derived
-- by PostgreSQL; callers cannot submit those values.
-- Assumes UUID identifiers and the columns currently used by the app.

begin;

create or replace function public.criar_pedido_seguro(
  p_product_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_product_name text;
  v_unit_price numeric;
  v_order public.product_orders%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception using errcode = '22023', message = 'Invalid quantity';
  end if;

  v_client_id := (select public.current_client_id());
  if v_client_id is null then
    raise exception using errcode = '42501', message = 'Client profile not found';
  end if;

  -- Atomic stock reservation prevents concurrent orders overselling inventory.
  update public.products p
     set stock_quantity = p.stock_quantity - p_quantity
   where p.id = p_product_id
     and p.is_available is true
     and p.stock_quantity >= p_quantity
  returning p.name, p.price into v_product_name, v_unit_price;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product unavailable or insufficient stock';
  end if;
  if v_unit_price is null or v_unit_price < 0 then
    raise exception using errcode = '22023', message = 'Invalid product price';
  end if;

  insert into public.product_orders
    (client_id, product_id, product_name, quantity, unit_price, total_price, status)
  values
    (v_client_id, p_product_id, v_product_name, p_quantity, v_unit_price,
     round(v_unit_price * p_quantity, 2), 'pending')
  returning * into v_order;

  return jsonb_build_object(
    'id', to_jsonb(v_order)->'id',
    'product_name', v_product_name,
    'quantity', p_quantity,
    'unit_price', v_unit_price,
    'total_price', round(v_unit_price * p_quantity, 2),
    'status', 'pending'
  );
end;
$$;

create or replace function public.solicitar_extra_seguro(
  p_service_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_service_name text;
  v_price numeric;
  v_order public.orders%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise exception using errcode = '22023', message = 'Notes too long';
  end if;
  v_client_id := (select public.current_client_id());
  if v_client_id is null then
    raise exception using errcode = '42501', message = 'Client profile not found';
  end if;

  select s.name, s.price into v_service_name, v_price
    from public.services_catalog s
   where s.id = p_service_id and s.is_available is true;
  if not found then
    raise exception using errcode = 'P0002', message = 'Service unavailable';
  end if;
  if v_price is null or v_price < 0 then
    raise exception using errcode = '22023', message = 'Invalid service price';
  end if;

  insert into public.orders
    (client_id, service_type, scheduled_date, total_amount, status, notes)
  values
    (v_client_id, 'Extra: ' || v_service_name, now(), v_price, 'pending',
     coalesce(nullif(trim(p_notes), ''), 'Pedido de Serviço Extra'))
  returning * into v_order;

  return jsonb_build_object(
    'id', to_jsonb(v_order)->'id', 'total_amount', v_price, 'status', 'pending'
  );
end;
$$;

-- Admin-created appointments have a separate privileged path. It fixes status
-- in the database; all other fields come from the authenticated admin UI.
create or replace function public.admin_criar_agendamento_seguro(
  p_client_id uuid,
  p_service_type text,
  p_scheduled_date timestamptz,
  p_total_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;
  if p_client_id is null or p_service_type is null or length(trim(p_service_type)) not between 1 and 200
     or p_scheduled_date is null or p_total_amount is null or p_total_amount < 0
     or (p_notes is not null and length(p_notes) > 2000) then
    raise exception using errcode = '22023', message = 'Invalid appointment';
  end if;
  if not exists (select 1 from public.clients c where c.id = p_client_id) then
    raise exception using errcode = '22023', message = 'Invalid client';
  end if;

  insert into public.orders
    (client_id, service_type, scheduled_date, total_amount, status, notes)
  values
    (p_client_id, trim(p_service_type), p_scheduled_date, p_total_amount, 'pending', p_notes)
  returning * into v_order;
  return jsonb_build_object('id', to_jsonb(v_order)->'id', 'status', 'pending');
end;
$$;

revoke all on function public.criar_pedido_seguro(uuid, integer) from public, anon;
revoke all on function public.solicitar_extra_seguro(uuid, text) from public, anon;
revoke all on function public.admin_criar_agendamento_seguro(uuid, text, timestamptz, numeric, text) from public, anon;
grant execute on function public.criar_pedido_seguro(uuid, integer) to authenticated;
grant execute on function public.solicitar_extra_seguro(uuid, text) to authenticated;
grant execute on function public.admin_criar_agendamento_seguro(uuid, text, timestamptz, numeric, text) to authenticated;

-- Authenticated users must use the validated RPCs. Admin API/server code using
-- service_role remains unaffected; admin browser flows use the admin RPC above.
revoke insert on public.product_orders from authenticated;
revoke insert on public.orders from authenticated;

commit;
