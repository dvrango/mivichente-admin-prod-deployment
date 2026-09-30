-- La condición comercial permanece guardada aun si se apaga has_delivery.
-- null = por confirmar; 0 = gratis; positivo = importe fijo en MXN.
alter table public.businesses
  add column delivery_fee numeric(10,2),
  add constraint businesses_delivery_fee_valid
    check (delivery_fee is null or delivery_fee between 0 and 99999999.99);

comment on column public.businesses.delivery_fee is
  'MXN por entrega aceptada: null = por confirmar, 0 = gratis, positivo = costo fijo. Ignorado mientras has_delivery sea false. Conserva la RLS de businesses.';
