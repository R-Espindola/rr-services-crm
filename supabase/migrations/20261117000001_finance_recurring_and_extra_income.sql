begin;

alter table public.finance_expenses
  add column if not exists is_recurring_monthly boolean not null default false,
  add column if not exists recurrence_day integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_expenses_recurrence_day_valid'
      and conrelid = 'public.finance_expenses'::regclass
  ) then
    alter table public.finance_expenses
      add constraint finance_expenses_recurrence_day_valid
      check (recurrence_day is null or recurrence_day between 1 and 31);
  end if;
end $$;

create table if not exists public.finance_extra_incomes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 160),
  amount numeric(10,2) not null check (amount > 0),
  category text not null check (category in ('freelance_web', 'bonus_servico', 'vendas', 'reembolso', 'outros')),
  income_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists finance_extra_incomes_date_idx
  on public.finance_extra_incomes(income_date desc);

alter table public.finance_extra_incomes enable row level security;

drop policy if exists finance_extra_incomes_admin_select on public.finance_extra_incomes;
drop policy if exists finance_extra_incomes_admin_insert on public.finance_extra_incomes;
drop policy if exists finance_extra_incomes_admin_update on public.finance_extra_incomes;
drop policy if exists finance_extra_incomes_admin_delete on public.finance_extra_incomes;

create policy finance_extra_incomes_admin_select on public.finance_extra_incomes
  for select to authenticated using (exists (
    select 1 from public.clients c where c.auth_user_id = (select auth.uid()) and c.role = 'admin'
  ));
create policy finance_extra_incomes_admin_insert on public.finance_extra_incomes
  for insert to authenticated with check (exists (
    select 1 from public.clients c where c.auth_user_id = (select auth.uid()) and c.role = 'admin'
  ));
create policy finance_extra_incomes_admin_update on public.finance_extra_incomes
  for update to authenticated using (exists (
    select 1 from public.clients c where c.auth_user_id = (select auth.uid()) and c.role = 'admin'
  )) with check (exists (
    select 1 from public.clients c where c.auth_user_id = (select auth.uid()) and c.role = 'admin'
  ));
create policy finance_extra_incomes_admin_delete on public.finance_extra_incomes
  for delete to authenticated using (exists (
    select 1 from public.clients c where c.auth_user_id = (select auth.uid()) and c.role = 'admin'
  ));

grant all on public.finance_extra_incomes to authenticated;

commit;
