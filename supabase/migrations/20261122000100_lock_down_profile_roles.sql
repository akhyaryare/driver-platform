-- Prevent self-assigned administrator roles and protect profile role changes.
-- Signup metadata is user-controlled; every new account must start as a driver.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    'driver'
  );
  return new;
end;
$$;

drop policy if exists "profiles_update_own" on public.profiles;
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Keep role changes exclusively in trusted server-side admin workflows.
