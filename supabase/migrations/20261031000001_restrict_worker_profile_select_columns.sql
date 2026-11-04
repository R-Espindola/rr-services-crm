-- Os clientes e trabalhadores só precisam destes campos no portal/agenda.
-- Administradores continuam a obter os dados completos através das ações
-- autenticadas do servidor com service_role.
begin;

revoke select on table public.worker_profiles from authenticated;
grant select (user_id, display_name, active)
  on table public.worker_profiles to authenticated;

commit;
