-- Hardening identified by Supabase security advisor (2026-11-22).
-- Apply only after reviewing/testing in an isolated staging project.

-- Views normally execute with the owner's privileges. Require caller RLS.
alter view public.driver_latest_locations set (security_invoker = true);
revoke select on public.driver_latest_locations from anon;

-- Signup trigger is invoked by Auth, not directly by API callers.
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- RLS policies use this helper for authenticated users; anonymous callers do not need it.
alter function public.is_admin() set search_path = '';
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Preserve safe profile self-service updates after the role lockdown migration.
-- Column-level UPDATE grant from the preceding migration prevents role edits.
create policy "profiles_update_safe_fields" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
