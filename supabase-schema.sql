-- Run this in your Supabase SQL editor to set up the database

-- 1. Entries table
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  picks jsonb not null,
  is_paid boolean default false,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Settings table
create table if not exists settings (
  key text primary key,
  value text not null
);

-- 3. Default settings
insert into settings (key, value) values ('locked', 'false') on conflict (key) do nothing;
insert into settings (key, value) values ('picks_visible', 'false') on conflict (key) do nothing;

-- 4. Allow public read/write on entries (entrants submit without logging in)
alter table entries enable row level security;
create policy "Anyone can insert entries" on entries for insert with check (true);
create policy "Anyone can read entries by id" on entries for select using (true);
create policy "Anyone can update entries" on entries for update using (true);

-- 5. Allow public read on settings
alter table settings enable row level security;
create policy "Anyone can read settings" on settings for select using (true);
create policy "Anyone can update settings" on settings for update using (true);
create policy "Anyone can insert settings" on settings for insert with check (true);
