alter table businesses
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz;
