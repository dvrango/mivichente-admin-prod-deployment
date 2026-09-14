-- business_service_variants: los tamaños/presentaciones de un platillo, con su
-- precio propio.
--
-- Motivación: `business_services` tiene un solo `price`. Una pizza con seis
-- tamaños no tiene dónde guardarlos, así que hoy viven aplanados dentro de
-- `description` como texto:
--
--   "Tamaños: chica $90, mediana $220, grande $240, familiar $260,
--    jumbo $280, XL $460. Contiene: jamón, piña."
--
-- y `price` guarda el de la chica. Eso convierte a `price` en un "desde"
-- disfrazado de precio: un carrito que sume `price` le manda al dueño
-- "1 pizza familiar — Total $90" cuando cuesta $260. Un ítem sin precio se ve
-- en pantalla y frena la suma; un "desde" suma mal en silencio y sale por
-- WhatsApp hacia el negocio. El segundo es el peligroso, y es el que bloquea
-- el pedido estructurado del MVP de delivery.
--
-- Por qué una tabla hija de `business_services` y no el salto a
-- `business_menu_items` (decidido con el usuario el 2026-09-14, ver Decision
-- Log): la parte cara de esa migración es capturar la estructura, no el
-- schema, y ese costo es idéntico hoy o después. Esta tabla es la misma pieza
-- en los dos modelos — el día que se migre se re-apunta su FK y el dato
-- capturado no se vuelve a teclear.
--
-- Alcance deliberado: SOLO precio por variante. Ingredientes, sabores y
-- opciones siguen aplanados en `description` como dice
-- `Modelar comida sobre business_services` — no bloquean un pedido. Tampoco
-- hay modificadores con costo ("orilla rellena +$30"): nadie los ha pedido y
-- meterlos aquí volvería esto el rediseño completo del menú.

create table public.business_service_variants (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.business_services(id) on delete cascade,
  -- business_id denormalizado a propósito. Las policies de escritura llaman a
  -- can_edit_business(business_id), y colgando solo de service_id habría que
  -- hacer un join dentro de cada policy. Es el mismo camino que ya tomó
  -- can_write_business_photo en 20260911120000. El trigger de abajo lo mantiene
  -- alineado con el del platillo padre para que no pueda mentir.
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- "chica", "mediana", "1/2 kilo", "jarra". Es lo que el cliente elige.
  name        text not null,
  -- not null, al revés que business_services.price: una variante sin precio no
  -- tiene razón de existir — el caso "cotiza tu evento" se resuelve dejando el
  -- platillo sin variantes y sin precio, como hasta hoy.
  price       numeric(10, 2) not null,
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null
);

comment on table public.business_service_variants is
  'Tamaños o presentaciones de un platillo, cada uno con su precio. Cuando un platillo tiene variantes, business_services.price pasa a leerse como "desde" (el menor de ellas).';

-- Lookup por platillo, ya ordenado (el menú carga todas las variantes de sus
-- ítems de un jalón).
create index business_service_variants_service_id_idx
  on public.business_service_variants (service_id, order_index);

-- Para las policies y para consultar todas las variantes de un negocio.
create index business_service_variants_business_id_idx
  on public.business_service_variants (business_id);

-- El business_id denormalizado no se confía al cliente: se copia del platillo
-- padre en cada escritura. Sin esto, alguien podría insertar una variante con
-- el business_id de un negocio que sí puede editar, colgada de un platillo de
-- otro negocio — y la policy lo dejaría pasar.
create or replace function public.set_variant_business_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  select s.business_id into new.business_id
    from public.business_services s
   where s.id = new.service_id;

  if new.business_id is null then
    raise exception 'El platillo % no existe', new.service_id;
  end if;

  return new;
end;
$function$;

create trigger business_service_variants_set_business_id
  before insert or update of service_id, business_id
  on public.business_service_variants
  for each row
  execute function public.set_variant_business_id();

create trigger business_service_variants_set_updated_at
  before update on public.business_service_variants
  for each row
  execute function public.set_updated_at();

-- RLS: mismo set que business_services tras el lock down del 2026-09-11.
alter table public.business_service_variants enable row level security;

-- anon ve la variante si vería su platillo: publicado y de un negocio activo.
create policy business_service_variants_public_read
  on public.business_service_variants
  for select
  to anon
  using (
    exists (
      select 1
        from public.business_services s
        join public.businesses b on b.id = s.business_id
       where s.id = business_service_variants.service_id
         and s.is_published = true
         and b.is_active = true
    )
  );

-- Lectura de staff sin scope por municipio, igual que el menú: el reviewer ve
-- negocios de otros municipios en solo lectura y tiene que ver sus precios.
create policy business_service_variants_select_auth
  on public.business_service_variants
  for select
  to authenticated
  using (public.is_staff());

create policy business_service_variants_insert
  on public.business_service_variants
  for insert
  to authenticated
  with check (public.can_edit_business(business_id));

create policy business_service_variants_update
  on public.business_service_variants
  for update
  to authenticated
  using (public.can_edit_business(business_id))
  with check (public.can_edit_business(business_id));

create policy business_service_variants_delete
  on public.business_service_variants
  for delete
  to authenticated
  using (public.can_edit_business(business_id));

-- Las policies no bastan sin el grant a nivel tabla.
grant select on public.business_service_variants to anon;
grant all on public.business_service_variants to authenticated;

-- ── Backfill: los 23 platillos que hoy llevan "Tamaños:" en la descripción ──
--
-- Todos son de Divla's Pizza. Se verificó contra prod que las 138 variantes
-- parsean limpio con esta misma expresión, sin una sola excepción: cada parte
-- es "<nombre> $<número>". Si alguna fallara, entraría con price null y el
-- not null la rechazaría — o sea que el backfill es fail-loud, no silencioso.
with bloque as (
  select
    s.id as service_id,
    s.business_id,
    substring(s.description from 'Tama[nñ]os:\s*([^.]*)') as lista
  from public.business_services s
  where s.description ~* 'Tama[nñ]os:'
),
partes as (
  select
    b.service_id,
    b.business_id,
    trim(p.parte) as parte,
    p.ord
  from bloque b,
       unnest(string_to_array(b.lista, ',')) with ordinality as p(parte, ord)
  where trim(p.parte) <> ''
)
insert into public.business_service_variants (service_id, business_id, name, price, order_index)
select
  p.service_id,
  p.business_id,
  trim(substring(p.parte from '^(.*?)\s*\$')),
  (replace(substring(p.parte from '\$\s*([0-9.,]+)'), ',', ''))::numeric(10, 2),
  p.ord - 1
from partes p;

-- Quita el fragmento "Tamaños: ..." de la descripción ahora que vive en su
-- tabla. "Contiene: ..." se queda: los ingredientes siguen siendo texto.
update public.business_services s
   set description = nullif(
         trim(regexp_replace(s.description, 'Tama[nñ]os:[^.]*\.?\s*', '', 'gi')),
         ''
       )
 where s.description ~* 'Tama[nñ]os:';

-- `price` del platillo pasa a ser el menor de sus variantes, o sea el "desde"
-- que las tres superficies van a etiquetar como tal. Hoy ya guardaba el de la
-- chica, así que en la práctica no cambia ningún número — lo que cambia es que
-- ahora es un invariante y no una coincidencia de captura.
update public.business_services s
   set price = v.min_price
  from (
    select service_id, min(price) as min_price
      from public.business_service_variants
     group by service_id
  ) v
 where v.service_id = s.id
   and s.price is distinct from v.min_price;
