-- ============================================================
-- Driver Platform – Supabase Schema
-- Run this in your Supabase SQL editor to set up the database
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  role        text not null check (role in ('admin', 'driver')) default 'driver',
  full_name   text not null,
  phone       text,
  email       text,
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'driver')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- DRIVERS
-- ============================================================
create table public.drivers (
  id            uuid default uuid_generate_v4() primary key,
  profile_id    uuid references public.profiles(id) on delete set null,
  name          text not null,
  phone         text not null,
  email         text,
  vehicle_plate text,
  status        text not null check (status in ('active', 'inactive', 'on_route')) default 'inactive',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- ROUTES
-- ============================================================
create table public.routes (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  description text,
  waypoints   jsonb default '[]'::jsonb,  -- array of {lat, lng, label}
  status      text not null check (status in ('active', 'inactive')) default 'active',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- DRIVER ROUTE ASSIGNMENTS
-- ============================================================
create table public.driver_routes (
  id          uuid default uuid_generate_v4() primary key,
  driver_id   uuid references public.drivers(id) on delete cascade not null,
  route_id    uuid references public.routes(id) on delete cascade not null,
  assigned_at timestamptz default now(),
  date        date not null default current_date,
  status      text not null check (status in ('pending', 'in_progress', 'completed')) default 'pending',
  unique(driver_id, route_id, date)
);

-- ============================================================
-- GPS LOCATIONS (realtime)
-- ============================================================
create table public.driver_locations (
  id          uuid default uuid_generate_v4() primary key,
  driver_id   uuid references public.drivers(id) on delete cascade not null,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    real,
  heading     real,
  speed       real,
  recorded_at timestamptz default now()
);

-- Index for fast latest-location queries
create index on public.driver_locations (driver_id, recorded_at desc);

-- View: latest location per driver
create or replace view public.driver_latest_locations as
select distinct on (driver_id)
  dl.driver_id,
  d.name as driver_name,
  d.status as driver_status,
  dl.lat,
  dl.lng,
  dl.heading,
  dl.speed,
  dl.recorded_at
from public.driver_locations dl
join public.drivers d on d.id = dl.driver_id
order by driver_id, recorded_at desc;

-- ============================================================
-- NOTIFICATIONS LOG
-- ============================================================
create table public.notifications (
  id          uuid default uuid_generate_v4() primary key,
  title       text not null,
  message     text not null,
  channel     text not null check (channel in ('sms', 'email', 'both')),
  recipients  text not null check (recipients in ('all', 'active', 'on_route')),
  sent_by     uuid references public.profiles(id),
  status      text not null check (status in ('pending', 'sent', 'failed')) default 'pending',
  sent_at     timestamptz,
  created_at  timestamptz default now()
);

-- ============================================================
-- WHATSAPP GROUP LINKS
-- ============================================================
create table public.whatsapp_groups (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  description text,
  link        text not null,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.drivers           enable row level security;
alter table public.routes            enable row level security;
alter table public.driver_routes     enable row level security;
alter table public.driver_locations  enable row level security;
alter table public.notifications     enable row level security;
alter table public.whatsapp_groups   enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Profiles: users can read their own; admins can read all
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- Admins: full access to everything operational
create policy "admin_all_drivers" on public.drivers
  for all using (public.is_admin());

create policy "admin_all_routes" on public.routes
  for all using (public.is_admin());

create policy "admin_all_driver_routes" on public.driver_routes
  for all using (public.is_admin());

create policy "admin_all_notifications" on public.notifications
  for all using (public.is_admin());

create policy "admin_all_whatsapp" on public.whatsapp_groups
  for all using (public.is_admin());

-- Drivers: can read their own assignments
create policy "driver_read_own_routes" on public.driver_routes
  for select using (
    driver_id in (
      select id from public.drivers where profile_id = auth.uid()
    )
  );

-- Driver locations: drivers can insert their own; admins can read all
create policy "driver_insert_own_location" on public.driver_locations
  for insert with check (
    driver_id in (
      select id from public.drivers where profile_id = auth.uid()
    )
  );

create policy "admin_read_all_locations" on public.driver_locations
  for select using (public.is_admin());

-- Drivers can read their own record
create policy "driver_read_own" on public.drivers
  for select using (profile_id = auth.uid() or public.is_admin());

-- WhatsApp links: all authenticated users can read
create policy "all_read_whatsapp" on public.whatsapp_groups
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME: enable for live GPS tracking
-- ============================================================
alter publication supabase_realtime add table public.driver_locations;
