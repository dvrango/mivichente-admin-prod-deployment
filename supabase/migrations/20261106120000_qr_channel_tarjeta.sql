-- Canal del QR del mostrador con su dirección nueva (mikitasks m7r8es7op).
--
-- El QR que descarga el admin pasa de https://vichente.com/{slug}/sellos?src=sellos-qr
-- a https://vichente.com/{slug}/tarjeta?src=tarjeta-qr: la tarjeta se llama
-- «tarjeta de cliente» y es neutra en la mecánica. Se cambió antes de imprimir
-- ningún QR.
--
-- `sellos-qr` se queda mapeado: en prod ya hay scans con ese src (las pruebas del
-- 2026-11-06), y sin la línea un recálculo del canal los mandaría a `otro`.
-- No hay filas con `tarjeta-qr` todavía, así que no hace falta recalcular `channel`.
--
-- Mismo mapeo que 20261103130000_qr_channel_sellos, más `tarjeta-qr`.
create or replace function public.qr_scan_channel_from_src(p_src text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_src is null               then null
    when p_src like 'share%'         then 'share'
    when p_src like 'menu-qr%'       then 'menu-qr'
    when p_src like 'opinion-qr%'    then 'opinion-qr'
    when p_src like 'tarjeta-qr%'    then 'tarjeta-qr'
    when p_src like 'sellos-qr%'     then 'sellos-qr'
    when p_src like 'sticker%'       then 'sticker'
    when p_src like 'post-ig%'       then 'post-ig'
    when p_src like 'post-fb%'       then 'post-fb'
    when p_src like 'fb-post%'       then 'post-fb'
    when p_src = 'landing-banner'    then 'landing'
    else                                  'otro'
  end
$$;

comment on column public.qr_scans.channel is
  'Canal por el que llegó el scan: menu-qr, opinion-qr, tarjeta-qr, sellos-qr (dirección vieja del QR del mostrador, retirada el 2026-11-06), sticker, share, post-ig, post-fb, landing, bot, otro. Lo pone siempre el trigger (ignora el del cliente): bot si el user-agent es de un crawler; si no, lo deriva de `src`.';
