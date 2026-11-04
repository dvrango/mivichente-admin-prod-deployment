-- Canal del QR del mostrador de la tarjeta de sellos (mikitasks o3w5njyf0).
--
-- El QR que descarga el admin es https://vichente.com/{slug}/sellos?src=sellos-qr:
-- el src es fijo, como el de opiniones. Sin esta línea los scans caerían en
-- `otro` y no se podrían medir como los demás QR.
--
-- Mismo mapeo que 20261010130000_business_feedback_coupons, más `sellos-qr`.
-- No hay filas con ese src todavía (la página de la landing no existe y el QR
-- no está impreso), así que no hace falta recalcular `channel`.
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
  'Canal por el que llegó el scan: menu-qr, opinion-qr, sellos-qr, sticker, share, post-ig, post-fb, landing, bot, otro. Lo pone siempre el trigger (ignora el del cliente): bot si el user-agent es de un crawler; si no, lo deriva de `src`.';
