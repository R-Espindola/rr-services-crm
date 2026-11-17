begin;

create table if not exists public.finance_allocation_rules (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid check (id = '00000000-0000-0000-0000-000000000001'::uuid),
  tax_reserve_pct numeric(5,2) not null default 20 check (tax_reserve_pct between 0 and 100),
  business_ops_pct numeric(5,2) not null default 20 check (business_ops_pct between 0 and 100),
  personal_weekly_pct numeric(5,2) not null default 40 check (personal_weekly_pct between 0 and 100),
  savings_pct numeric(5,2) not null default 20 check (savings_pct between 0 and 100),
  weekly_fixed_target numeric(12,2) not null default 0 check (weekly_fixed_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_allocation_rules_total_pct check (
    tax_reserve_pct + business_ops_pct + personal_weekly_pct + savings_pct <= 100
  )
);

insert into public.finance_allocation_rules (id)
values ('00000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 160),
  amount numeric(12,2) not null check (amount > 0),
  expense_type text not null check (expense_type in ('personal', 'business')),
  category text not null default 'Geral' check (length(trim(category)) between 1 and 80),
  expense_date date not null default current_date,
  is_recurring_weekly boolean not null default false,
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_expenses_date_idx on public.finance_expenses(expense_date desc);
create index if not exists finance_expenses_type_idx on public.finance_expenses(expense_type, expense_date desc);

alter table public.finance_allocation_rules enable row level security;
alter table public.finance_expenses enable row level security;

drop policy if exists finance_allocation_rules_admin_select on public.finance_allocation_rules;
drop policy if exists finance_allocation_rules_admin_insert on public.finance_allocation_rules;
drop policy if exists finance_allocation_rules_admin_update on public.finance_allocation_rules;
drop policy if exists finance_expenses_admin_select on public.finance_expenses;
drop policy if exists finance_expenses_admin_insert on public.finance_expenses;
drop policy if exists finance_expenses_admin_update on public.finance_expenses;
drop policy if exists finance_expenses_admin_delete on public.finance_expenses;

create policy finance_allocation_rules_admin_select on public.finance_allocation_rules
  for select to authenticated using ((select public.is_admin()));
create policy finance_allocation_rules_admin_insert on public.finance_allocation_rules
  for insert to authenticated with check ((select public.is_admin()));
create policy finance_allocation_rules_admin_update on public.finance_allocation_rules
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy finance_expenses_admin_select on public.finance_expenses
  for select to authenticated using ((select public.is_admin()));
create policy finance_expenses_admin_insert on public.finance_expenses
  for insert to authenticated with check ((select public.is_admin()));
create policy finance_expenses_admin_update on public.finance_expenses
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy finance_expenses_admin_delete on public.finance_expenses
  for delete to authenticated using ((select public.is_admin()));

grant select, insert, update on public.finance_allocation_rules to authenticated;
grant select, insert, update, delete on public.finance_expenses to authenticated;

commit;
