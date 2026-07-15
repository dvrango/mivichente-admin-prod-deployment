-- has_delivery: el negocio ofrece envío/entrega a domicilio.
alter table businesses
  add column if not exists has_delivery boolean not null default false;
