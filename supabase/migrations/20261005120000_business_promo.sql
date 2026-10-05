-- Promoción del negocio (tarea 8v3i4y8os). Solo se MUESTRA en la ficha de la
-- app: no toca carrito, precios ni el mensaje de WhatsApp. El cliente le toma
-- captura y el negocio la aplica a mano.
--
-- Columnas en `businesses` y no tabla aparte: es una promo por negocio, hereda
-- la RLS de `businesses` (anon lee, staff escribe en su municipio) y viaja con
-- el `select('*')` que ya hace la app. El texto es público por diseño.
alter table public.businesses
  add column promo_active boolean not null default false,
  add column promo_title text,
  add column promo_body text,
  add column promo_ends_at date,
  add column promo_updated_at timestamptz,
  add constraint businesses_promo_title_length
    check (promo_title is null or char_length(promo_title) between 1 and 80),
  add constraint businesses_promo_body_length
    check (promo_body is null or char_length(promo_body) <= 2000),
  add constraint businesses_promo_active_needs_title
    check (not promo_active or nullif(btrim(promo_title), '') is not null);

comment on column public.businesses.promo_active is
  'Interruptor de la promoción. Apagarla no borra el texto. Vigente = promo_active y (promo_ends_at null o hoy en Durango <= promo_ends_at); lo evalúa el cliente.';
comment on column public.businesses.promo_title is
  'Titular de la promoción, el que se ve en la tarjeta de la ficha. Máximo 80 caracteres.';
comment on column public.businesses.promo_body is
  'Detalles y términos. Bloques separados por renglón en blanco; en un bloque de varios renglones el primero es subtítulo; renglones que empiezan con "-" o "•" son viñetas.';
comment on column public.businesses.promo_ends_at is
  'Último día válido, inclusivo, en hora de Durango. Null = sin fecha de fin.';
comment on column public.businesses.promo_updated_at is
  'Cuándo cambió el contenido de la promoción. La app lo usa como llave de "ya la vio" para mostrar el modal una vez por promoción y device. Lo sella un trigger.';

-- El sello lo pone la DB y no la server action: así cualquier escritor
-- (admin, SQL, un script) que cambie el contenido hace que el modal vuelva a
-- salir. Prender o apagar sin cambiar el texto NO lo mueve: es la misma promo.
create or replace function public.businesses_stamp_promo()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    new.promo_updated_at := case
      when new.promo_title is not null or new.promo_body is not null or new.promo_ends_at is not null
        then now()
    end;
  elsif new.promo_title is distinct from old.promo_title
     or new.promo_body is distinct from old.promo_body
     or new.promo_ends_at is distinct from old.promo_ends_at then
    new.promo_updated_at := now();
  else
    -- El sello es de la DB: un cliente no lo mueve sin cambiar el contenido,
    -- así nadie vuelve a mostrar (o esconde) el modal a todos a mano.
    new.promo_updated_at := old.promo_updated_at;
  end if;
  return new;
end;
$function$;

revoke execute on function public.businesses_stamp_promo() from public, anon, authenticated;

drop trigger if exists businesses_stamp_promo on public.businesses;
create trigger businesses_stamp_promo
before insert or update of promo_title, promo_body, promo_ends_at, promo_updated_at on public.businesses
for each row execute function public.businesses_stamp_promo();
