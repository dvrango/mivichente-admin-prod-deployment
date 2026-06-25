-- Salidas extra dependientes del día de la semana (ej. camión solo domingos).
-- Aditiva: `times[]` sigue siendo el horario diario base; `extra_times` mezcla
-- horas que aplican solo ciertos días. Formato: [{"time":"17:30","days":[7]}]
-- días ISO Lun=1..Dom=7 (== Dart DateTime.weekday). ODM queda en '[]'.
ALTER TABLE bus_schedules
  ADD COLUMN IF NOT EXISTS extra_times jsonb NOT NULL DEFAULT '[]';
