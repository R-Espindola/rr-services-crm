begin;

-- No esquema atual os dados de cliente vivem em public.clients; public.profiles
-- contém apenas preferências/RGPD e aponta para clients.client_id.
insert into public.properties (
  client_id,
  label,
  street_address,
  postal_code,
  city,
  company_provides_supplies,
  is_active
)
select
  c.id,
  'Morada Principal',
  trim(c.address),
  coalesce(
    case when c.postal_code ~ '^[0-9]{4}-[0-9]{3}$' then c.postal_code end,
    substring(c.address from '([0-9]{4}-[0-9]{3})'),
    '0000-000'
  ),
  coalesce(nullif(trim(c.locality), ''), 'Portugal'),
  true,
  true
from public.clients c
where c.role = 'client'
  and c.address is not null
  and length(trim(c.address)) > 0
  and not exists (
    select 1
      from public.properties p
     where p.client_id = c.id
  );

commit;
