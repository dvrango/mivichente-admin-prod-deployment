-- business_service_option_groups / business_service_options: lo que el cliente
-- ELIGE de un platillo además del tamaño — sabor, tipo de leche, fría o
-- caliente, fruta y base, y los extras que cuestan.
--
-- Motivación: hoy todo eso vive aplanado en `business_services.description`
-- como texto:
--
--   "Sabores: capuchino, caramelo, moka."
--   "Extra: shot de espresso +$12"
--
-- El menú de mesa y la ficha lo pintan parseando ese texto, que alcanza para
-- LEER pero no para PEDIR. En el carrito de la Etapa 1 el cliente escribiría el
-- sabor en la nota libre (o no lo escribiría), y un extra con precio escrito en
-- una nota NO entra al total: el negocio cobraría $12 de menos y se enteraría
-- al cobrar. Caso que disparó esto: K-fféss, 21 platillos, 16 con una elección
-- obligatoria y 3 con extra con precio (revisado en prod el 2026-09-16).
--
-- ── Frontera con business_service_variants ────────────────────────────────
--
-- Son dos cosas distintas y la diferencia es QUÉ LE HACEN AL PRECIO:
--
--   * Tamaño / presentación  -> `business_service_variants`. FIJA el precio.
--     "Mediano $40 / Grande $50". Es absoluto: el café mediano no tiene un
--     precio base al que se le suma algo, tiene su propio precio.
--
--   * Grupo de opciones      -> estas tablas. SUMA al precio, cero incluido.
--     "shot de espresso +$12", "leche deslactosada +$0".
--
-- De ahí sale la única fórmula que el carrito va a usar:
--
--   precio_línea = (variante elegida ?? business_services.price)
--                  + Σ price_delta de las opciones elegidas
--
-- `business_services.price` sigue siendo el "desde" (el menor de las
-- variantes, invariante que puso 20260914180000). Un extra NO lo toca: si lo
-- tocara, la card del menú anunciaría un precio que nadie paga.
--
-- Un mismo platillo usa las dos a la vez — el Café caliente de K-fféss tiene
-- tamaño (Mediano/Grande) Y extra (shot de espresso). Por eso no se unificaron
-- en un solo modelo con "modo de precio": el carrito necesita las dos
-- semánticas de todos modos, y unificar obligaba a migrar las 140 variantes ya
-- en prod y a reescribir las tres superficies que las leen (editor del admin,
-- landing/src/lib/menu-de-mesa.ts, mobile BusinessRepository.getById), dos días
-- después de entregarlas.
--
-- Por qué siguen colgadas de `business_services` y no de un
-- `business_menu_items` nuevo (confirmado con el usuario el 2026-09-16):
-- ninguna columna de aquí es exclusiva de comida. Elegir opciones aplica igual
-- a "Uñas acrílicas" (largo, diseño con costo) o a Mariachi la Colmena (horas,
-- número de músicos), y el tamaño con precio ya lo pide un negocio con
-- is_food = false (Helados Happi: "6 oz" y "8 oz" como dos filas sueltas).
-- El fork se justifica el día que aparezca un campo que SOLO tenga sentido en
-- comida y que no se pueda colgar de una tabla hija — disponibilidad por
-- horario del ítem, inventario, tiempo de preparación, combos que referencian
-- otros ítems. Para entonces lo capturado aquí se re-apunta cambiando la FK, no
-- se vuelve a teclear.
--
-- Alcance deliberado: SOLO la estructura. No se toca ninguna descripción y
-- ninguna superficie lee todavía estas tablas. Capturar en el admin
-- (`sqknppnyb`), pintar en el menú de mesa (`la1v73w8j`) y en la ficha
-- (`2rvssb8pl`), y recapturar los menús borrando el texto (`2d0ckbksx`) son
-- tareas aparte, en ese orden: el texto de la descripción es lo único que
-- funciona hasta que las tres superficies lean la estructura.

-- ── Grupos ────────────────────────────────────────────────────────────────

create table public.business_service_option_groups (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.business_services(id) on delete cascade,
  -- business_id denormalizado, mismo motivo que en business_service_variants:
  -- las policies de escritura llaman a can_edit_business(business_id) y
  -- colgando solo de service_id habría que hacer un join dentro de cada
  -- policy. El trigger de abajo lo copia del platillo padre para que no pueda
  -- mentir.
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- "Sabor", "Leche", "Extra", "Frutas". Es el encabezado que ve el cliente.
  name        text not null,
  -- Cuántas opciones del grupo puede elegir el cliente.
  --
  -- NO hay columna `is_required` a propósito: obligatorio es `min_select >= 1`,
  -- y tener las dos cosas permitiría capturar un grupo "obligatorio" con
  -- min_select = 0, que se contradice a sí mismo. Un solo hecho, un solo lugar.
  --
  --   Sabor obligatorio, uno solo   -> min 1, max 1
  --   Extra opcional, uno solo      -> min 0, max 1
  --   Ingredientes, hasta tres      -> min 0, max 3
  --   Ingredientes, los que quiera  -> min 0, max null
  min_select  integer not null default 1,
  max_select  integer,
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,

  constraint business_service_option_groups_select_range check (
    min_select >= 0
    and (max_select is null or max_select >= greatest(min_select, 1))
  )
);

comment on table public.business_service_option_groups is
  'Lo que el cliente elige de un platillo además del tamaño (sabor, leche, extras). El grupo SUMA al precio; el tamaño, que lo FIJA, vive en business_service_variants. Obligatorio = min_select >= 1; max_select null = sin tope.';

-- Dos grupos con el mismo nombre en un platillo son una captura equivocada, no
-- un caso de uso: el cliente vería "Sabor" dos veces sin saber cuál es cuál.
-- Nota para el editor del admin: intercambiar los nombres de dos grupos en un
-- mismo guardado falla aquí. Es fail-loud y sale en pantalla al guardar.
create unique index business_service_option_groups_name_uniq
  on public.business_service_option_groups (service_id, lower(trim(name)));

create index business_service_option_groups_service_id_idx
  on public.business_service_option_groups (service_id, order_index);

create index business_service_option_groups_business_id_idx
  on public.business_service_option_groups (business_id);

-- ── Opciones ──────────────────────────────────────────────────────────────

create table public.business_service_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.business_service_option_groups(id) on delete cascade,
  -- Denormalizado igual que en el grupo, y por lo mismo: la policy de escritura
  -- no debe hacer dos joins para llegar al negocio.
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- "Capuchino", "Deslactosada", "Shot de espresso".
  name        text not null,
  -- Lo que esta opción le SUMA al precio de la línea. 0 es el caso normal: de
  -- los 19 grupos que K-fféss necesita, 16 son elecciones sin costo.
  --
  -- El check de no-negativo es deliberado. Nadie ha pedido descuentos por
  -- opción, y un signo mal capturado bajaría el total sin síntoma visible en
  -- pantalla — el negocio cobra de menos y lo descubre al cobrar. El día que un
  -- negocio pida "sin queso -$10", se quita el check con una migración de una
  -- línea.
  price_delta numeric(10, 2) not null default 0,
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,

  constraint business_service_options_price_delta_no_negativo check (price_delta >= 0)
);

comment on table public.business_service_options is
  'Cada opción elegible de un grupo. price_delta es lo que SUMA al precio de la línea (0 = sin costo); nunca lo fija ni lo baja.';

create unique index business_service_options_name_uniq
  on public.business_service_options (group_id, lower(trim(name)));

create index business_service_options_group_id_idx
  on public.business_service_options (group_id, order_index);

create index business_service_options_business_id_idx
  on public.business_service_options (business_id);

-- ── business_id copiado del padre, nunca confiado al cliente ──────────────
--
-- Sin esto, alguien podría insertar un grupo con el business_id de un negocio
-- que sí puede editar, colgado de un platillo de otro negocio, y la policy lo
-- dejaría pasar. Mismo razonamiento y misma forma que set_variant_business_id().

create or replace function public.set_option_group_business_id()
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

create or replace function public.set_option_business_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  select g.business_id into new.business_id
    from public.business_service_option_groups g
   where g.id = new.group_id;

  if new.business_id is null then
    raise exception 'El grupo de opciones % no existe', new.group_id;
  end if;

  return new;
end;
$function$;

-- ── El tamaño no se captura dos veces ─────────────────────────────────────
--
-- Un grupo NO puede fijar el precio, solo sumarle. Capturar los tamaños aquí
-- obligaría a teclearlos como deltas sobre el "desde" ("Mediano +$0",
-- "Grande +$10"), lo que deja el mismo platillo con tamaño en dos tablas y al
-- carrito sumando sobre un precio que ya no es el que el cliente eligió.
--
-- La convención sola no alcanza para impedirlo, así que se rechaza por nombre.
-- Es una heurística, no una demostración: atrapa la captura equivocada obvia y
-- su mensaje dice a dónde va el dato. Un grupo legítimo que se llame así
-- ("Tamaño de la bolsa") se renombra.
create or replace function public.reject_size_option_group()
returns trigger
language plpgsql
as $function$
declare
  normalizado text;
begin
  normalizado := trim(regexp_replace(
    lower(translate(new.name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
    '\s+', ' ', 'g'
  ));

  if normalizado = any (array[
    'tamano', 'tamanos',
    'size', 'sizes',
    'presentacion', 'presentaciones'
  ]) then
    raise exception
      'Los tamaños se capturan como variantes del platillo (business_service_variants), no como grupo de opciones. El grupo "%" tiene que ir ahí, o llamarse de otra forma si no es un tamaño.',
      new.name;
  end if;

  return new;
end;
$function$;

create trigger business_service_option_groups_set_business_id
  before insert or update of service_id, business_id
  on public.business_service_option_groups
  for each row
  execute function public.set_option_group_business_id();

create trigger business_service_option_groups_reject_size
  before insert or update of name
  on public.business_service_option_groups
  for each row
  execute function public.reject_size_option_group();

create trigger business_service_option_groups_set_updated_at
  before update on public.business_service_option_groups
  for each row
  execute function public.set_updated_at();

create trigger business_service_options_set_business_id
  before insert or update of group_id, business_id
  on public.business_service_options
  for each row
  execute function public.set_option_business_id();

create trigger business_service_options_set_updated_at
  before update on public.business_service_options
  for each row
  execute function public.set_updated_at();

-- ── RLS: mismo set que business_service_variants ──────────────────────────

alter table public.business_service_option_groups enable row level security;
alter table public.business_service_options enable row level security;

-- anon ve el grupo si vería su platillo: publicado y de un negocio activo.
create policy business_service_option_groups_public_read
  on public.business_service_option_groups
  for select
  to anon
  using (
    exists (
      select 1
        from public.business_services s
        join public.businesses b on b.id = s.business_id
       where s.id = business_service_option_groups.service_id
         and s.is_published = true
         and b.is_active = true
    )
  );

-- Y la opción, si vería su grupo. La condición se repite en vez de delegarse al
-- grupo: una policy que confíe en que "el grupo ya filtró" deja de filtrar el
-- día que la del grupo cambie.
create policy business_service_options_public_read
  on public.business_service_options
  for select
  to anon
  using (
    exists (
      select 1
        from public.business_service_option_groups g
        join public.business_services s on s.id = g.service_id
        join public.businesses b on b.id = s.business_id
       where g.id = business_service_options.group_id
         and s.is_published = true
         and b.is_active = true
    )
  );

-- Lectura de staff sin scope por municipio, igual que el menú y las variantes:
-- el reviewer ve negocios de otros municipios en solo lectura.
create policy business_service_option_groups_select_auth
  on public.business_service_option_groups
  for select
  to authenticated
  using (public.is_staff());

create policy business_service_options_select_auth
  on public.business_service_options
  for select
  to authenticated
  using (public.is_staff());

create policy business_service_option_groups_insert
  on public.business_service_option_groups
  for insert
  to authenticated
  with check (public.can_edit_business(business_id));

create policy business_service_option_groups_update
  on public.business_service_option_groups
  for update
  to authenticated
  using (public.can_edit_business(business_id))
  with check (public.can_edit_business(business_id));

create policy business_service_option_groups_delete
  on public.business_service_option_groups
  for delete
  to authenticated
  using (public.can_edit_business(business_id));

create policy business_service_options_insert
  on public.business_service_options
  for insert
  to authenticated
  with check (public.can_edit_business(business_id));

create policy business_service_options_update
  on public.business_service_options
  for update
  to authenticated
  using (public.can_edit_business(business_id))
  with check (public.can_edit_business(business_id));

create policy business_service_options_delete
  on public.business_service_options
  for delete
  to authenticated
  using (public.can_edit_business(business_id));

-- Las policies no bastan sin el grant a nivel tabla.
grant select on public.business_service_option_groups to anon;
grant select on public.business_service_options to anon;
grant all on public.business_service_option_groups to authenticated;
grant all on public.business_service_options to authenticated;
