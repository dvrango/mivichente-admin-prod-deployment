-- Le quita TRUNCATE (y TRIGGER y REFERENCES) a `anon` y `authenticated` sobre
-- todas las tablas de `public`, y cambia el default para que las tablas nuevas
-- no vuelvan a nacer con esos privilegios.
--
-- ── Qué estaba mal ────────────────────────────────────────────────────────
--
-- Supabase trae default privileges en `public` que otorgan `arwdDxtm` sobre
-- TODA tabla nueva a `anon`, `authenticated` y `service_role`:
--
--   postgres | public | r | {anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres, ...}
--
-- Esa `D` es TRUNCATE. Y **TRUNCATE no pasa por RLS**: una policy puede negar
-- todo y la tabla se vacía igual, porque lo único que decide es el privilegio
-- de tabla. Verificado en prod el 2026-09-16 sobre `businesses`,
-- `business_services`, `business_service_variants` y las dos tablas de
-- opciones: `has_table_privilege('anon', …, 'TRUNCATE')` daba `true` en las
-- cinco.
--
-- Cuánto riesgo hay hoy: bajo, no nulo. PostgREST no expone ningún verbo que
-- emita TRUNCATE, y la anon key es un JWT para PostgREST, no credenciales de
-- Postgres — así que desde el bundle web no hay camino. El hueco se vuelve
-- alcanzable el día que alguien agregue una función `security invoker` que
-- trunque, o cualquier ruta que ejecute SQL arbitrario. No se deja abierto
-- esperando a ver quién llega primero.
--
-- ── Por qué el intento anterior no sirvió ─────────────────────────────────
--
-- `20260916120000` cambió `grant all to authenticated` por las cuatro
-- operaciones enumeradas, creyendo que eso cerraba el hueco. No lo cerró: un
-- `grant` acotado **no revoca** lo que el default privilege ya otorgó al crear
-- la tabla. Sólo un `revoke` lo hace. En la DB local quedó bien porque ahí se
-- corrió un `revoke all` a mano para alinear la base con el archivo; en prod la
-- tabla nació de cero y el default ganó. O sea que `db:rls:check` daba verde en
-- local mientras prod estaba abierto — el harness no ve esta clase de
-- divergencia porque corre contra una base donde el problema ya no existía.
--
-- ── Alcance ───────────────────────────────────────────────────────────────
--
-- Las tres privilegios que se quitan no los usa nadie de la app:
--   TRUNCATE   — PostgREST no lo emite.
--   TRIGGER    — crear triggers es cosa de migraciones, que corren como postgres.
--   REFERENCES — crear FKs, igual.
-- Se quedan intactos SELECT / INSERT / UPDATE / DELETE, que son los que
-- PostgREST sí usa y los que RLS sí filtra. Ninguna lectura ni escritura de la
-- app cambia.

do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke truncate, trigger, references on public.%I from anon, authenticated',
      t.relname
    );
  end loop;
end $$;

-- Y que las tablas futuras no nazcan abiertas.
--
-- Esto es MÁS que quitar TRUNCATE, y es deliberado: a partir de aquí una tabla
-- nueva en `public` nace SIN NINGÚN privilegio para `anon` ni `authenticated`,
-- y la migración que la crea tiene que otorgar lo que esa tabla necesite —
-- justo lo que ya hacen `20260914180000` y `20260916120000`, que traen su
-- `grant select … to anon` explícito.
--
-- Por qué así y no sólo quitando TRUNCATE del default: el default heredado no
-- sólo regalaba TRUNCATE, regalaba las cuatro operaciones de datos. Una tabla
-- nueva a la que se le olvide el `enable row level security` nace legible y
-- escribible por `anon` —la key que va en el bundle web— sin que nadie lo haya
-- decidido, y eso no grita: se ve igual de bien que si estuviera cerrada. Es la
-- misma forma del agujero del 2026-09-11. Con el default cerrado, el olvido
-- falla ruidoso (42501) en local, antes de prod.
--
-- Verificado en local creando una tabla de prueba dentro de una transacción:
-- nace con `select` false para `anon` y para `authenticated`, y `service_role`
-- conserva el suyo (lo usa el admin con la service key, que nunca sale del
-- servidor).
--
-- Alcance real de `alter default privileges`: aplica sólo a los objetos que
-- cree el rol que ejecuta esta línea. Las migraciones corren como `postgres`,
-- así que cubre todo lo que salga de `supabase/migrations/`. Si algún día una
-- tabla apareciera creada por `supabase_admin` (no pasa con nuestro flujo),
-- volvería a nacer con el default de ese rol.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

-- Fail-loud: si algo volvió a otorgar TRUNCATE mientras esto corría, la
-- migración aborta en vez de reportar éxito sobre una base que sigue abierta.
--
-- El chequeo va por OID y no por nombre a propósito. Con
-- `has_table_privilege('anon', format('public.%I', tablename), …)` sobre
-- `pg_tables`, el planner puede evaluar la función ANTES del filtro del where y
-- pasarle tablas de `pg_catalog`, que no existen bajo el nombre `public.x`: la
-- migración truena con `relation "public.pg_statistic" does not exist`. Pasó al
-- escribir esto. El OID ya viene resuelto y no depende del orden de evaluación.
do $$
declare
  abiertas integer;
begin
  select count(*) into abiertas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and (
       has_table_privilege('anon', c.oid, 'TRUNCATE')
       or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
     );

  if abiertas > 0 then
    raise exception
      'Quedaron % tablas de public con TRUNCATE otorgado a anon o authenticated.',
      abiertas;
  end if;
end $$;
