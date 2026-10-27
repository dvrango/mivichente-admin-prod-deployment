-- missing_business_reports: avisos de "este negocio falta en el directorio"
-- que deja un usuario de la app cuando su búsqueda no encuentra nada
-- (mikitasks `k4mu1g2sv`).
--
-- Por qué una tabla propia y no una existente:
--   - `business_reports` exige `business_id not null` y su policy de borrado
--     usa `can_edit_business(business_id)`: reporta un negocio que YA existe.
--   - `business_registrations` es el alta que pide un dueño, con teléfono,
--     contacto y municipio obligatorios. Un vecino que avisa "falta una
--     zapatería" no tiene esos datos.
--
-- El término buscado es el dato que sirve para el levantamiento de campo, así
-- que los avisos no se borran: se marcan `resolved` o `dismissed`. Borrar los
-- atendidos borraría el registro de qué pidió la gente.
--
-- Quién ve qué (decidido por el usuario el 2026-10-27):
--   - anon/authenticated (la app): solo insertan, y solo en estado `pending`.
--   - staff (`is_staff()`: admin y reviewer de cualquier municipio): lee y
--     cambia el status. Un aviso no tiene negocio ni municipio, así que el
--     scoping por municipio no aplica.
--   - Nadie borra.
--
-- Es la primera escritura del panel que se decide con `is_staff()` y no con
-- `can_edit_business()`. El comentario de `is_staff()` (20260911120000) dice
-- que solo es el gate de lectura; aquí no aplica porque `can_edit_business()`
-- necesita un negocio, y un aviso no tiene.
--
-- La nota admite 1000 caracteres aunque la app corta en 500: `char_length`
-- cuenta code points y el `maxLength` de Flutter cuenta grafemas, así que un
-- emoji compuesto ocupa varios aquí. El margen evita que el insert truene por
-- eso.

create table public.missing_business_reports (
  id          uuid        primary key default gen_random_uuid(),
  query       text        not null,
  note        text,
  typed       boolean     not null,
  device_id   text,
  status      text        not null default 'pending',
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),

  constraint missing_business_reports_query_length
    check (char_length(btrim(query)) between 2 and 100),
  constraint missing_business_reports_note_length
    check (note is null or char_length(note) between 1 and 1000),
  constraint missing_business_reports_status_check
    check (status in ('pending', 'resolved', 'dismissed'))
);

comment on table public.missing_business_reports is
  'Aviso de un negocio que falta, enviado desde el estado vacío de la búsqueda de la app. Lo crea anon; lo lee y lo marca el staff. No se borra: el término es el dato del levantamiento.';
comment on column public.missing_business_reports.query is
  'Término que el usuario buscó y no dio resultados, tal cual (trim).';
comment on column public.missing_business_reports.note is
  'Texto opcional del usuario: nombre del negocio, dónde está, teléfono.';
comment on column public.missing_business_reports.typed is
  'true si el término lo tecleó la persona; false si llegó por un tap de categoría del home, un deep link o una búsqueda reciente. search_events no distingue esto.';
comment on column public.missing_business_reports.status is
  '''pending'' al crearse; el staff lo pasa a ''resolved'' (se atendió) o ''dismissed'' (ruido).';

create index missing_business_reports_status_created_idx
  on public.missing_business_reports (status, created_at desc);

alter table public.missing_business_reports enable row level security;

-- Los default privileges de Supabase dan todo a anon y authenticated, TRUNCATE
-- incluido (ver 20260916140000). Se revoca y se otorga solo lo necesario, por
-- columna: la app no puede fijar `status` ni `reviewed_at`, y el staff solo
-- puede cambiar esas dos.
--
-- El grant explícito a anon también es necesario por otra razón: sin él, el
-- insert funciona en prod por un default de proyecto y falla en la DB local
-- (ver 20260721130000).
revoke all on public.missing_business_reports from anon, authenticated;
grant insert (query, note, typed, device_id)
  on public.missing_business_reports to anon, authenticated;
grant select on public.missing_business_reports to authenticated;
grant update (status, reviewed_at)
  on public.missing_business_reports to authenticated;

create policy missing_business_reports_insert
  on public.missing_business_reports
  for insert
  to anon, authenticated
  with check (status = 'pending' and reviewed_at is null);

create policy missing_business_reports_select_staff
  on public.missing_business_reports
  for select
  to authenticated
  using (public.is_staff());

create policy missing_business_reports_update_staff
  on public.missing_business_reports
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
