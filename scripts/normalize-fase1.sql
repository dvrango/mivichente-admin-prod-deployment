-- ============================================================
-- Normalización de negocios — FASE 1 (mecánico determinista)
-- Vichente App v2 — generado 2026-07-09
--
-- Qué hace (bajo riesgo, sin criterio humano):
--   1. Teléfonos -> solo 10 dígitos (183 rows). Solo toca los que
--      quedan exactamente en 10 dígitos; los raros (<10 o basura)
--      se dejan intactos para Fase 2.
--   2. address 'Dirección no especificada' -> NULL (78 rows).
--   3. Trim de espacios en name (2 rows).
--
-- USO:
--   1) Correr PASO 0 (backup) primero.
--   2) Correr los SELECT de PREVIEW y revisar.
--   3) Correr el BEGIN...COMMIT.
--   4) Correr VERIFICACIÓN post.
-- ============================================================

-- ---------- PASO 0: BACKUP (obligatorio antes de tocar nada) ----------
create table if not exists public._backup_businesses_fase1 as
  select * from public.businesses;
-- Para revertir: update desde este backup por id, o drop de la tabla si todo bien.


-- ---------- PREVIEW 1: teléfonos que cambiarán ----------
with n as (
  select id, name, phone,
         regexp_replace(coalesce(phone,''),'[^0-9]','','g') as digits
  from public.businesses
)
select name, phone as antes, digits as despues
from n
where phone is not null and phone <> digits and length(digits) = 10
order by name;   -- esperado: 183 rows

-- ---------- PREVIEW 2: address placeholder ----------
select id, name, address
from public.businesses
where address = 'Dirección no especificada';   -- esperado: 78 rows

-- ---------- PREVIEW 3: nombres con espacios ----------
select id, name as antes, trim(name) as despues
from public.businesses
where name <> trim(name);   -- esperado: 2 rows


-- ---------- APLICAR ----------
begin;

-- 1. Teléfonos a 10 dígitos (solo los que quedan en 10)
update public.businesses
set phone = regexp_replace(phone,'[^0-9]','','g'),
    updated_at = now()
where phone is not null
  and phone <> regexp_replace(phone,'[^0-9]','','g')
  and length(regexp_replace(phone,'[^0-9]','','g')) = 10;

-- 2. Address placeholder -> NULL
update public.businesses
set address = null,
    updated_at = now()
where address = 'Dirección no especificada';

-- 3. Trim de nombres
update public.businesses
set name = trim(name),
    updated_at = now()
where name <> trim(name);

commit;


-- ---------- VERIFICACIÓN post ----------
select
  count(*) filter (where phone ~ '[^0-9]') as phones_con_no_digito,
  count(*) filter (where address = 'Dirección no especificada') as addr_placeholder_restante,
  count(*) filter (where name <> trim(name)) as names_sin_trim
from public.businesses;   -- esperado: 0, 0, 0

-- Si todo OK, opcional limpiar backup:
-- drop table public._backup_businesses_fase1;
