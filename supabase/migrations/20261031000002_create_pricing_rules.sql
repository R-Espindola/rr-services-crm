-- Dynamic admin-managed price list for R&R Services.
-- Only authenticated admins can access this table through the Data API.

begin;

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  valid_from date not null,
  service_type text not null check (length(btrim(service_type)) > 0),
  frequency text not null check (length(btrim(frequency)) > 0),
  typology text not null check (length(btrim(typology)) > 0),
  base_price numeric(10, 2) not null check (base_price >= 0),
  extra_hourly_rate numeric(10, 2) not null default 15.00 check (extra_hourly_rate >= 0),
  created_at timestamptz not null default now(),
  constraint pricing_rules_valid_from_service_frequency_typology_key
    unique (valid_from, service_type, frequency, typology)
);

create index if not exists pricing_rules_lookup_idx
  on public.pricing_rules (service_type, frequency, typology, valid_from desc);

alter table public.pricing_rules enable row level security;

revoke all on table public.pricing_rules from anon, authenticated;
grant select, insert, update, delete on table public.pricing_rules to authenticated;
grant select, insert, update, delete on table public.pricing_rules to service_role;

drop policy if exists pricing_rules_admin_all on public.pricing_rules;
create policy pricing_rules_admin_all on public.pricing_rules
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Base prices supplied for the current R&R Services price schedule.
-- T4/T5 ranges are represented as separate selectable scopes so the CRM can
-- load a concrete starting price while still allowing a manual adjustment.
insert into public.pricing_rules
  (valid_from, service_type, frequency, typology, base_price, extra_hourly_rate)
values
  ('2026-01-01', 'Limpeza Residencial', 'semanal', 'T0 / T1', 50.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'quinzenal', 'T0 / T1', 50.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'semanal', 'T2', 50.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'quinzenal', 'T2', 55.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'semanal', 'T3', 60.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'quinzenal', 'T3', 65.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'semanal', 'T4 / Moradia M', 70.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'quinzenal', 'T4 / Moradia M', 70.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'semanal', 'T4 / Moradia M (ampliada)', 80.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'quinzenal', 'T4 / Moradia M (ampliada)', 80.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'semanal', 'T5 / Moradia Grande', 85.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'quinzenal', 'T5 / Moradia Grande', 85.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'semanal', 'T5 / Moradia Grande (sótão/garagem)', 105.00, 15.00),
  ('2026-01-01', 'Limpeza Residencial', 'quinzenal', 'T5 / Moradia Grande (sótão/garagem)', 105.00, 15.00),
  ('2026-01-01', 'Limpeza Comercial / Escritórios', 'semanal', 'Escritório Pequeno (1x/semana)', 45.00, 15.00),
  ('2026-01-01', 'Limpeza Comercial / Escritórios', '3x/semana', 'Empresa / Grande (3x/semana)', 55.00, 15.00),
  ('2026-01-01', 'Higienização de Estofados', 'pontual', 'Sofá 2 Lugares', 50.00, 15.00),
  ('2026-01-01', 'Higienização de Estofados', 'pontual', 'Sofá 3 Lugares', 65.00, 15.00),
  ('2026-01-01', 'Higienização de Estofados', 'pontual', 'Chaise Longue', 75.00, 15.00),
  ('2026-01-01', 'Higienização de Estofados', 'pontual', 'Colchão Casal', 50.00, 15.00),
  ('2026-01-01', 'Limpeza Profunda / Pós-Obra', 'pontual', 'Serviço base (até 3 horas)', 50.00, 15.00),
  ('2026-01-01', 'Vidros e Caixilharia', 'pontual', 'Serviço base (até 3 horas)', 50.00, 15.00)
on conflict (valid_from, service_type, frequency, typology) do update
set base_price = excluded.base_price,
    extra_hourly_rate = excluded.extra_hourly_rate;

commit;
