-- qr_scans: separar "qué canal" de "qué negocio".
--
-- Hasta hoy la tabla guardaba una sola columna de texto (`src`) que cargaba las
-- dos preguntas a la vez. Con dos QRs de menú se aguanta; con veinte no, y el
-- problema es irreversible porque los QR se imprimen y se pegan en mesas: una
-- errata en un valor crea un bucket que nadie nota y que ya no se corrige en el
-- papel, y un negocio que cambia de slug pierde la liga con su histórico.
--
-- El dato que hace esto barato: el negocio YA viaja en la ruta
-- (vichente.com/<slug>/menu), así que el servidor sabe de quién es el scan sin
-- que el parámetro impreso lo diga. Esta migración no cambia lo que se imprime,
-- solo lo que se guarda.

alter table public.qr_scans
  add column business_id  uuid references public.businesses(id) on delete set null,
  add column channel      text,
  add column slug_at_scan text;

comment on column public.qr_scans.business_id is
  'Negocio dueño del QR/enlace escaneado. Lo deriva el servidor de la ruta, no del parámetro impreso. Null en canales que no son por negocio (los stickers de la campaña de julio).';
comment on column public.qr_scans.channel is
  'Canal por el que llegó el scan: menu-qr, sticker, share, post-ig, post-fb, otro. Si el cliente no lo manda, lo deriva un trigger desde `src`.';
comment on column public.qr_scans.slug_at_scan is
  'Slug tal como venía impreso al momento del scan. El negocio puede renombrarse; el papel pegado en la mesa no. Guardarlo deja saber qué QR físico se usó.';
comment on column public.qr_scans.src is
  'Valor crudo del parámetro ?src=, tal cual llegó. Se conserva para no romper lo que ya inserta (stickers, ?src=share) y como evidencia del detalle (número de sticker, nombre del post). Para agrupar, usar `channel`.';

-- Mapeo src -> canal. Vocabulario alineado a UTM medium/source a propósito: el
-- día que entre GA4, los QR ya impresos hablan su idioma y no hay que traducir.
-- Lo que no encaja cae en 'otro', que es justo la señal de que alguien inventó
-- un valor nuevo: `select distinct src from qr_scans where channel = 'otro'`.
create or replace function public.qr_scan_channel_from_src(p_src text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_src is null         then null
    when p_src = 'share'       then 'share'
    when p_src like 'menu-qr%' then 'menu-qr'
    when p_src like 'sticker%' then 'sticker'
    when p_src like 'post-ig%' then 'post-ig'
    when p_src like 'post-fb%' then 'post-fb'
    else                            'otro'
  end
$$;

-- Trigger y no columna generada: una columna generada no se puede recalcular
-- cuando el mapeo crezca, y además impediría que el cliente mande el canal
-- explícito (que es lo que hace la ruta del menú).
create or replace function public.qr_scans_set_channel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.channel is null then
    new.channel := public.qr_scan_channel_from_src(new.src);
  end if;
  return new;
end;
$$;

create trigger qr_scans_set_channel_trigger
  before insert or update of src, channel on public.qr_scans
  for each row execute function public.qr_scans_set_channel();

-- Filas viejas: se rellena `channel` (derivable del texto sin ambigüedad) y se
-- deja `business_id` en null a propósito. Son 12 filas en prod de dos canales
-- que no eran por negocio; adivinar el negocio parseando el src es exactamente
-- lo que esta migración deja de hacer.
update public.qr_scans
set channel = public.qr_scan_channel_from_src(src)
where channel is null;

alter table public.qr_scans alter column channel set not null;

create index qr_scans_channel_created_idx
  on public.qr_scans (channel, created_at desc);
create index qr_scans_business_created_idx
  on public.qr_scans (business_id, created_at desc)
  where business_id is not null;

-- La política de insert existente ("anyone can log a qr scan", with check true)
-- ya cubre las columnas nuevas. Un anónimo puede mandar un business_id ajeno,
-- igual que hoy puede mandar cualquier `src`: no es superficie nueva, y la FK
-- garantiza al menos que sea un negocio real. El grant es idempotente y está
-- aquí porque la DB local viene sin él.
grant insert on public.qr_scans to anon, authenticated;
