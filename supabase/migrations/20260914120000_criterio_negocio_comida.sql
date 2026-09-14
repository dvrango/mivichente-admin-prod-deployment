-- Criterio único de "este negocio ofrece comida pedible".
--
-- Motivación: el MVP de delivery necesita decidir en qué fichas aparece el
-- carrito. Hoy no hay una respuesta confiable a esa pregunta — hay tres, y no
-- coinciden:
--   1. admin  (`features/businesses/queries.ts`): categories.type de la
--      categoría PRINCIPAL (businesses.category_id).
--   2. mobile (`business_repository.dart`): categories.type matcheado contra
--      business_categories, o sea principal O secundaria.
--   3. landing (`components/negocios/data.ts`): un array hardcodeado de 6
--      nombres de categoría, escrito cuando la base tenía 28 categorías. Hoy
--      hay 79.
-- Y el cuarto señalador, `businesses.services_label`, es un string de display
-- ('Menú' / 'Servicios' / null) que nadie garantiza. Que hoy coincida 100% con
-- categories.type en los 26 negocios con ítems es circunstancial: hay al menos
-- dos caminos que lo desincronizan sin error ni aviso —
-- `bulkSetPrimaryCategory` cambia category_id y no toca el label, y el `type`
-- de una categoría es editable desde el admin sin que nada propague a sus
-- negocios. El scraper y el alta de campo insertan sin label.
--
-- Decisión (2026-09-14): la categoría PRINCIPAL manda. Un negocio cuya
-- categoría principal es de tipo 'food' puede recibir pedidos; uno cuya
-- principal es 'business' no, aunque tenga una categoría secundaria de comida.
-- Se eligió la regla más restrictiva porque es predecible y porque hoy no
-- cambia a nadie: cero negocios activos tienen principal y secundarias con
-- `type` discrepante. La alternativa (basta una secundaria) dejaría que un
-- negocio entre al pedido por una categoría que alguien agregó sin pensar en
-- pedidos.
--
-- Nota de alcance: "Bares" queda dentro (es type='food', 11 negocios activos).
-- Se revisa cuando haya un bar real en el piloto, no antes.

-- 1. Corrección de datos: "Fotografía" estaba marcada como comida.
--
-- Son 10 estudios fotográficos activos (Foto Estudio GALA, Nostro Studio,
-- Paloma Salas Fotografía...). No hacía daño visible porque ninguno tiene ítems
-- en business_services, pero con el carrito les aparecería el botón de pedido.
-- Es el único error de clasificación que salió al revisar las 79 categorías.
--
-- Ya lo corrigió el usuario a mano desde el admin el 2026-09-14, así que en prod
-- este UPDATE no toca nada. Se queda igual porque es idempotente y porque la DB
-- local todavía arrastra el valor viejo.
update public.categories
   set type = 'business'
 where name = 'Fotografía'
   and type = 'food';

-- 2. La respuesta canónica a la pregunta.
--
-- Se escribe como función sobre la fila de businesses para que PostgREST la
-- exponga como campo computado: `select=*,is_food` desde cualquier cliente.
-- Así los tres repos preguntan lo mismo en vez de reimplementar el criterio.
--
-- Mira businesses.category_id (la principal denormalizada), no
-- business_categories, que es donde viven también las secundarias.
create or replace function public.is_food(b public.businesses)
returns boolean
language sql
stable
as $function$
  select exists (
    select 1
      from public.categories c
     where c.id = b.category_id
       and c.type = 'food'
  );
$function$;

comment on function public.is_food(public.businesses) is
  'Si el negocio ofrece comida pedible: su categoría PRINCIPAL es de tipo food. Criterio único para mostrar el carrito. No usar services_label, que es solo display.';

-- 3. services_label deja de poder divergir.
--
-- El campo sigue siendo lo que siempre fue —el título de la sección en el
-- perfil— pero se vuelve derivado en vez de escrito por el cliente. Un trigger
-- cierra de una vez los cuatro caminos de desincronización en lugar de parchear
-- cada call site, que es lo que dejaría entrar al quinto.
create or replace function public.set_services_label()
returns trigger
language plpgsql
as $function$
declare
  cat_type text;
begin
  select c.type into cat_type
    from public.categories c
   where c.id = new.category_id;

  -- Sin categoría principal todavía (alta de campo, scraper) se deja null: el
  -- cliente cae a 'Servicios' por default y el label se corrige solo cuando
  -- alguien le asigne categoría.
  if cat_type is null then
    new.services_label := null;
  elsif cat_type = 'food' then
    new.services_label := 'Menú';
  else
    new.services_label := 'Servicios';
  end if;

  return new;
end;
$function$;

drop trigger if exists businesses_set_services_label on public.businesses;

create trigger businesses_set_services_label
  before insert or update of category_id, services_label
  on public.businesses
  for each row
  execute function public.set_services_label();

-- 4. Backfill: alinear lo que ya estaba escrito (o sin escribir).
update public.businesses b
   set services_label = case
         when c.type = 'food' then 'Menú'
         when c.type is not null then 'Servicios'
         else null
       end
  from public.categories c
 where c.id = b.category_id
   and b.services_label is distinct from case
         when c.type = 'food' then 'Menú'
         else 'Servicios'
       end;

-- Negocios sin categoría principal: el label no tiene de dónde derivarse.
update public.businesses
   set services_label = null
 where category_id is null
   and services_label is not null;
