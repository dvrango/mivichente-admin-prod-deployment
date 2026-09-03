-- business_services: RLS scopeada por municipio + rastro de quién editó.
--
-- Qué estaba mal: la tabla nació en `20260716120000_add_business_services.sql`,
-- que es POSTERIOR a la migración de roles (`20260704120000_add_profiles_and_roles.sql`),
-- así que nunca le llegó el scoping por municipio que sí tienen business_hours,
-- business_photos y business_categories. Se quedó con
-- `business_services_admin_all` — FOR ALL to authenticated using(true) with
-- check(true) — o sea: un reviewer (Jaime en Nombre de Dios, Dani en Villa
-- Unión) podía escribir el menú de cualquier negocio de cualquier municipio.
-- Lo único que lo detenía era la UI, que lo pone en solo lectura. La DB no.
--
-- Se vuelve urgente ahora porque el editor de menú nuevo le mete escrituras
-- granulares (update por ítem) a esta tabla.

-- ============================================================
-- can_edit_business(): la condición de autorización, en un solo lugar
-- ============================================================
--
-- Hasta hoy el repo repetía `(public.is_admin() or b.municipio =
-- public.user_municipio())` inline en cada policy — está copiada una docena de
-- veces en la migración de roles. Acá se extrae a función para no copiarla otra
-- vez: el día que un dueño de negocio pueda editar su propia ficha desde este
-- mismo admin, se cambia esta función y no una docena de policies.
--
-- Esto NO adelanta el portal de dueños (sigue pospuesto por decisión). Es solo
-- no cerrarse la puerta con algo que hoy cuesta cero.
--
-- security definer, igual que is_admin()/user_municipio(): la autorización no
-- debe depender de si el que pregunta alcanza a ver la fila de `businesses`.
-- Hoy `businesses_select` es using(true) para authenticated, así que da lo
-- mismo; mañana puede no serlo, y entonces la policy hija se rompería en
-- silencio (0 filas afectadas, sin error).
--
-- Costo: un security definer NO se inlinea, así que se evalúa una vez por fila.
-- Aceptable acá — toda lectura/escritura de business_services va filtrada por
-- business_id y el negocio más grande tiene 83 ítems.
--
-- Ojo con el null: un reviewer sin municipio da `b.municipio = null` -> null ->
-- no autoriza. Es el mismo comportamiento que la condición inline que sustituye.

create or replace function public.can_edit_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id
      and (public.is_admin() or b.municipio = public.user_municipio())
  );
$$;

comment on function public.can_edit_business(uuid) is
  'True si el usuario actual puede ESCRIBIR el negocio dado: admin (sin restricción) o reviewer del mismo municipio. Punto único de la regla de autorización de escritura sobre un negocio y sus tablas hijas. No aplica a lectura: leer negocios de otros municipios sí está permitido (ver 20260711120000).';

grant execute on function public.can_edit_business(uuid) to authenticated;

-- ============================================================
-- Policies por operación (adiós al FOR ALL using(true))
-- ============================================================

drop policy if exists "business_services_admin_all" on public.business_services;

-- SELECT abierto a authenticated a propósito, NO scopeado por municipio.
-- Es la misma decisión de `20260711120000_reviewer_read_all_municipios.sql`:
-- el reviewer ve negocios de otros municipios en el panel (solo lectura), así
-- que también tiene que ver su menú. Scopear el select acá le vaciaría el menú
-- en el detalle del negocio — una regresión, no una protección.
-- Lo que se cierra es la ESCRITURA, que es lo que estaba abierto.
create policy business_services_select_auth
  on public.business_services
  for select
  to authenticated
  using (true);

create policy business_services_insert
  on public.business_services
  for insert
  to authenticated
  with check (public.can_edit_business(business_id));

-- business_hours no tiene policy de UPDATE porque se guarda con delete+insert.
-- Acá sí hace falta: el editor de menú nuevo actualiza ítem por ítem.
-- El with check cubre además el caso de mover un ítem a otro business_id: el
-- destino también tiene que ser editable.
create policy business_services_update
  on public.business_services
  for update
  to authenticated
  using (public.can_edit_business(business_id))
  with check (public.can_edit_business(business_id));

create policy business_services_delete
  on public.business_services
  for delete
  to authenticated
  using (public.can_edit_business(business_id));

-- `business_services_public_read` (anon) NO se toca: es la que deja leer el
-- menú a la app mobile y al menú de mesa. Los grants tampoco — ya están desde
-- la migración de julio.

-- ============================================================
-- Autoría: quién capturó y quién editó por última vez
-- ============================================================
--
-- Mismo patrón que businesses.created_by/updated_by
-- (`20260704130000_add_business_authorship.sql`). Nullable a propósito: las 246
-- filas que ya existen no tienen a quién atribuirse y no se backfillean —
-- inventar un autor es peor que no tenerlo.
--
-- Van en esta migración, aunque todavía nadie las escriba, porque agregarlas
-- después es otra migración y otro db:push. Las actions empiezan a llenarlas en
-- el siguiente paso del editor de menú.

alter table public.business_services
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

comment on column public.business_services.created_by is
  'Perfil que capturó el ítem. Null en los ítems anteriores a 2026-09 (no hay backfill: no se sabe quién los cargó).';
comment on column public.business_services.updated_by is
  'Perfil que hizo la última edición del ítem. Null si nunca se editó desde que existe la columna.';
