-- Store the component costs used by the updated quote calculator.
-- Existing quote rows are intentionally not rewritten; the UI handles their
-- legacy labor-only estimate when calculating the displayed margin.

begin;

alter table public.quotes
  add column if not exists estimated_hours numeric(8, 2),
  add column if not exists regional_travel_cost numeric(10, 2),
  add column if not exists consumables_cost numeric(10, 2);

alter table public.quotes
  drop constraint if exists quotes_estimated_hours_nonnegative,
  drop constraint if exists quotes_regional_travel_cost_nonnegative,
  drop constraint if exists quotes_consumables_cost_nonnegative;

alter table public.quotes
  add constraint quotes_estimated_hours_nonnegative
    check (estimated_hours is null or estimated_hours >= 0),
  add constraint quotes_regional_travel_cost_nonnegative
    check (regional_travel_cost >= 0),
  add constraint quotes_consumables_cost_nonnegative
    check (consumables_cost is null or consumables_cost >= 0);

commit;
