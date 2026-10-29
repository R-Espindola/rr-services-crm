-- Contact details and business title used by the admin team directory.
-- Auth remains the source of truth for credentials and account email.

begin;

alter table public.worker_profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists job_title text not null default 'Trabalhador';

update public.worker_profiles as wp
set email = lower(au.email),
    phone = nullif(au.phone, '')
from auth.users as au
where au.id = wp.user_id
  and (wp.email is null or wp.phone is null);

create unique index if not exists worker_profiles_email_lower_uidx
  on public.worker_profiles (lower(email))
  where email is not null;

alter table public.worker_profiles
  drop constraint if exists worker_profiles_job_title_length,
  add constraint worker_profiles_job_title_length
    check (length(trim(job_title)) between 1 and 80),
  drop constraint if exists worker_profiles_phone_length,
  add constraint worker_profiles_phone_length
    check (phone is null or length(phone) between 7 and 30);

commit;
