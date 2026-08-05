-- Horario partido: permitir 2+ turnos el mismo día.
--
-- Trabajo de campo (2026-08-05): muchos negocios abren en la mañana, cierran a
-- comer y reabren en la tarde. `UNIQUE (business_id, day_of_week)` lo bloqueaba
-- a nivel de constraint: literalmente no se podía insertar el segundo turno, y
-- el workaround era escribir el horario partido en la descripción.
--
-- El unique viejo se cambia por uno que incluye `opens_at`: sigue impidiendo
-- filas duplicadas exactas (mismo negocio, mismo día, misma hora de apertura),
-- que es lo único que el unique original protegía de verdad, pero deja pasar dos
-- turnos con horas distintas.
--
-- Las filas existentes (1 por negocio+día) satisfacen el unique nuevo, así que
-- no hay que migrar datos.
--
-- `businesses_open_now()` (ver 20260728100000) NO necesita cambio: ya evalúa con
-- un EXISTS por fila de `business_hours`, así que con dos turnos basta con que
-- uno cubra la hora actual — y el hueco de en medio queda cerrado solo.

ALTER TABLE business_hours
  DROP CONSTRAINT IF EXISTS business_hours_business_id_day_of_week_key;

ALTER TABLE business_hours
  ADD CONSTRAINT business_hours_business_day_opens_key
  UNIQUE (business_id, day_of_week, opens_at);

COMMENT ON TABLE business_hours IS
  'Horario semanal. Puede haber más de una fila por negocio+día (horario partido: mañana y tarde). day_of_week: 0=Dom … 6=Sáb. Sin filas para un día = cerrado.';
