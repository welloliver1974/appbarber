-- Add buffer_minutes to services table
-- Execute this in Supabase Dashboard > SQL Editor or via Supabase CLI

alter table services
  add column if not exists buffer_minutes integer not null default 0;
