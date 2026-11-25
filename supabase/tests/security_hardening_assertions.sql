-- Run against an isolated staging database AFTER applying both 20261122 migrations.
-- Read-only assertions. Raises an exception if a security invariant is broken.
do $verify$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='driver_latest_locations'
      and 'security_invoker=true'=any(coalesce(c.reloptions,array[]::text[]))
  ) then raise exception 'Latest locations view must use security_invoker'; end if;

  if has_table_privilege('anon','public.driver_latest_locations','SELECT')
  then raise exception 'Anonymous users can SELECT the latest locations view'; end if;

  if has_function_privilege('anon','public.handle_new_user()','EXECUTE')
    or has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
  then raise exception 'Signup trigger is callable by API users'; end if;

  if has_function_privilege('anon','public.is_admin()','EXECUTE')
  then raise exception 'Anonymous callers can execute is_admin'; end if;

  if not has_function_privilege('authenticated','public.is_admin()','EXECUTE')
  then raise exception 'RLS admin helper unavailable to signed-in users'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles'
      and policyname='profiles_update_safe_fields' and cmd='UPDATE'
  ) then raise exception 'Safe profile update policy missing'; end if;

  if has_column_privilege('authenticated','public.profiles','role','UPDATE')
  then raise exception 'Authenticated role can modify profile role'; end if;

  if not has_column_privilege('authenticated','public.profiles','full_name','UPDATE')
  then raise exception 'Profile name updates unavailable'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('handle_new_user','is_admin')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig,array[]::text[])) config
        where config like 'search_path=%'
      )
  ) then raise exception 'Privileged function search_path not pinned'; end if;
end
$verify$;
