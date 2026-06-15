alter table businesses
  add column if not exists phone_is_whatsapp boolean not null default false,
  add column if not exists maps_url text;
