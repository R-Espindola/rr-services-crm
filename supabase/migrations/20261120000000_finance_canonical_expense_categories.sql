begin;

alter table public.revolut_transactions_log
  drop constraint if exists revolut_transactions_log_category_check;

update public.revolut_transactions_log
   set category = case category
     when 'Combustível' then 'combustivel'
     when 'Supermercado' then 'supermercado'
     when 'Produtos' then 'produtos'
     else category
   end
 where category in ('Combustível', 'Supermercado', 'Produtos');

alter table public.revolut_transactions_log
  add constraint revolut_transactions_log_category_check
  check (category in ('combustivel', 'supermercado', 'produtos', 'tecnologia', 'habitacao', 'outros', 'Transferência recebida'));

create or replace function public.process_revolut_notification(
  p_bank_tx_id text,
  p_title text,
  p_notification_text text,
  p_amount numeric,
  p_direction text,
  p_merchant_name text,
  p_counterparty_name text,
  p_transaction_at timestamptz,
  p_category text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_candidate record;
  v_match_count integer := 0;
  v_order_id uuid;
begin
  if p_bank_tx_id is null or p_bank_tx_id !~ '^[0-9a-f]{64}$'
     or p_title is null or length(p_title) not between 1 and 200
     or p_notification_text is null or length(p_notification_text) not between 1 and 4000
     or (p_merchant_name is not null and length(p_merchant_name) > 160)
     or (p_counterparty_name is not null and length(p_counterparty_name) > 160)
     or p_amount is null or p_amount = 0 or p_amount <> round(p_amount, 2)
     or p_direction is null or p_direction not in ('expense', 'income')
     or p_transaction_at is null
     or p_category is null or p_category not in ('combustivel', 'supermercado', 'produtos', 'tecnologia', 'habitacao', 'outros', 'Transferência recebida')
     or (p_direction = 'expense' and p_amount > 0)
     or (p_direction = 'income' and p_amount < 0)
     or (p_direction = 'income' and p_category <> 'Transferência recebida')
     or (p_direction = 'expense' and p_category = 'Transferência recebida') then
    raise exception using errcode = '22023', message = 'Invalid Revolut notification';
  end if;

  insert into public.revolut_transactions_log (
    bank_tx_id, title, notification_text, amount, direction,
    merchant_name, counterparty_name, transaction_at, category
  ) values (
    p_bank_tx_id, p_title, p_notification_text, p_amount, p_direction,
    p_merchant_name, p_counterparty_name, p_transaction_at, p_category
  )
  on conflict (bank_tx_id) do nothing;

  if not found then
    return jsonb_build_object('inserted', false, 'reconciled', false);
  end if;

  if p_direction = 'income' then
    for v_candidate in
      select o.id
        from public.orders o
       where o.total_amount = p_amount
         and o.payment_status is distinct from 'paid'
         and o.status <> 'cancelled'
       limit 2
       for update of o
    loop
      v_match_count := v_match_count + 1;
      v_order_id := v_candidate.id;
    end loop;

    if v_match_count = 1 then
      update public.orders
         set payment_status = 'paid'
       where id = v_order_id;

      update public.revolut_transactions_log
         set matched_order_id = v_order_id
       where bank_tx_id = p_bank_tx_id;
    end if;
  end if;

  return jsonb_build_object('inserted', true, 'reconciled', v_match_count = 1);
end;
$$;

revoke all on function public.process_revolut_notification(
  text, text, text, numeric, text, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.process_revolut_notification(
  text, text, text, numeric, text, text, text, timestamptz, text
) to service_role;

commit;
