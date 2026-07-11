-- Add is_combo flag to services
alter table services
  add column if not exists is_combo boolean not null default false;