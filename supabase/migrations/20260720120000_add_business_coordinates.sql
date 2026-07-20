-- Coordenadas del negocio, capturadas con el GPS del celular en el modo campo.
--
-- Hasta ahora el GPS sólo se guardaba embebido dentro de `maps_url`
-- (https://www.google.com/maps/search/?api=1&query=LAT,LNG), lo cual sirve para
-- abrir Maps pero no para nada más: no se puede consultar por cercanía, no se
-- puede pintar un mapa embebido sin parsear un string, y una URL pegada a mano
-- por el admin no trae ese formato.
--
-- Columnas planas y no PostGIS a propósito: lo irreversible es el dato (hay que
-- pararse físicamente en el negocio para capturarlo), no el mecanismo de query.
-- Con lat/lng ya se puede hacer mapa, rutas y proximidad por bounding box. Si
-- algún día hace falta ST_DWithin, se habilita PostGIS y se deriva una columna
-- geography de estas dos — sin volver a caminar el pueblo.
alter table businesses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  -- Precisión reportada por el GPS, en metros. Permite descartar después las
  -- lecturas malas (tomadas dentro de un local, sin línea de vista al cielo).
  add column if not exists location_accuracy_m double precision;

-- Rangos válidos. Atrapa un swap de lat/lng, que es el error clásico: las
-- longitudes de México (~-104) no caben en el rango de latitud.
alter table businesses
  drop constraint if exists businesses_latitude_range;
alter table businesses
  add constraint businesses_latitude_range
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table businesses
  drop constraint if exists businesses_longitude_range;
alter table businesses
  add constraint businesses_longitude_range
  check (longitude is null or (longitude >= -180 and longitude <= 180));

-- Índice compuesto para el barrido por bounding box ("negocios cerca de mí").
create index if not exists businesses_coords_idx
  on businesses (latitude, longitude)
  where latitude is not null and longitude is not null;
