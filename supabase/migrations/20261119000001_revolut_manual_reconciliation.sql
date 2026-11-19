begin;

alter table public.revolut_transactions_log
  add column if not exists converted_extra_income_id uuid
    references public.finance_extra_incomes(id) on delete set null;

drop policy if exists revolut_transactions_log_admin_select on public.revolut_transactions_log;
create policy revolut_transactions_log_admin_select on public.revolut_transactions_log
  for select to authenticated using ((select public.is_admin()));

grant select on public.revolut_transactions_log to authenticated;

create or replace function public.reconcile_revolut_transaction_with_order(
  p_log_id text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_transaction public.revolut_transactions_log%rowtype;
begin
  if coalesce(public.is_admin(), false) is not true then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  select *
    into v_transaction
    from public.revolut_transactions_log
   where bank_tx_id = p_log_id
     and direction = 'income'
     and matched_order_id is null
     and converted_extra_income_id is null
   for update;

  if not found then
    raise exception using errcode = '22023', message = 'Revolut transaction is not pending review';
  end if;

  perform 1
    from public.orders o
   where o.id = p_order_id
     and o.total_amount = v_transaction.amount
     and o.payment_status is distinct from 'paid'
     and o.status <> 'cancelled'
   for update;

  if not found then
    raise exception using errcode = '22023', message = 'Order is not eligible for this transaction';
  end if;

  update public.orders
     set payment_status = 'paid'
   where id = p_order_id;

  update public.revolut_transactions_log
     set matched_order_id = p_order_id
   where bank_tx_id = p_log_id;

  return jsonb_build_object('reconciled', true);
end;
$$;

create or replace function public.convert_revolut_transaction_to_extra_income(
  p_log_id text,
  p_category text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_transaction public.revolut_transactions_log%rowtype;
  v_income_id uuid;
begin
  if coalesce(public.is_admin(), false) is not true then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  if p_category is null or p_category not in ('freelance_web', 'bonus_servico', 'vendas', 'reembolso', 'outros') then
    raise exception using errcode = '22023', message = 'Invalid extra income category';
  end if;

  select *
    into v_transaction
    from public.revolut_transactions_log
   where bank_tx_id = p_log_id
     and direction = 'income'
     and amount > 0
     and matched_order_id is null
     and converted_extra_income_id is null
   for update;

  if not found then
    raise exception using errcode = '22023', message = 'Revolut transaction is not pending review';
  end if;

  if v_transaction.amount > 99999999.99 then
    raise exception using errcode = '22023', message = 'Revolut amount exceeds extra income limit';
  end if;

  insert into public.finance_extra_incomes (title, amount, category, income_date, notes)
  values (
    left('Revolut: ' || coalesce(nullif(btrim(v_transaction.counterparty_name), ''), nullif(btrim(v_transaction.title), ''), 'Renda recebida'), 160),
    v_transaction.amount,
    p_category,
    (v_transaction.transaction_at at time zone 'Europe/Lisbon')::date,
    v_transaction.notification_text
  )
  returning id into v_income_id;

  update public.revolut_transactions_log
     set converted_extra_income_id = v_income_id
   where bank_tx_id = p_log_id;

  return jsonb_build_object('extra_income_id', v_income_id);
end;
$$;

revoke all on function public.reconcile_revolut_transaction_with_order(text, uuid) from public, anon;
revoke all on function public.convert_revolut_transaction_to_extra_income(text, text) from public, anon;
grant execute on function public.reconcile_revolut_transaction_with_order(text, uuid) to authenticated;
grant execute on function public.convert_revolut_transaction_to_extra_income(text, text) to authenticated;

commit;
