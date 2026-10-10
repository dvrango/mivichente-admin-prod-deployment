-- qr_scans: los crawlers van a su propio canal y el canal ya no lo fuerza el cliente.
-- Tareas ou94da61h (canal mal asignado) y n3ufss795 (crawlers contados como scans).
--
-- Dos problemas que se resuelven en el mismo trigger:
--
-- 1. Cada vez que alguien pega un link de Vichente en WhatsApp o Facebook, el crawler
--    de la plataforma baja la página para armar la vista previa y eso quedaba como un
--    scan: 257 de 762 filas en prod el 2026-10-10. Ahora el trigger les pone
--    `channel = 'bot'`. No se borran: un preview de WhatsApp quiere decir que alguien
--    pegó el link en un chat, y esa señal sirve. Pero `group by channel` ya los separa
--    sin que nadie escriba la lista de user-agents al leer.
-- 2. La página del menú mandaba `channel = 'menu-qr'` para cualquier `src`, así que el
--    post de Facebook de Snacky (`fb-post-aug26`) contaba como QR de mesa. Y
--    `landing-banner`, el origen con más volumen, se escondía en `otro`. El landing deja
--    de mandar el canal y el mapeo aprende los valores que genera el propio código.

-- Crawlers por user-agent. Validado contra las 762 filas de prod del 2026-10-10: marca
-- 257 como crawler y ninguna de las 89 de navegadores in-app (FBAN/FBAV/FB_IAB e
-- Instagram son personas abriendo el link dentro de la app, no confundirlos con
-- facebookexternalhit). `cubot` es una marca de celulares que contiene "bot".
-- Una lista de bots envejece: lo que se le escape cae en su canal normal, como antes.
create or replace function public.qr_scan_is_bot(p_user_agent text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_user_agent ~* '(bot|crawler|spider|facebookexternalhit|meta-externalagent|meta-webindexer|^whatsapp/|^curl/|headless|python-requests|go-http-client|panscient|dataprovider|builtwith)'
    and p_user_agent !~* 'cubot',
    false
  )
$$;

-- No revocar EXECUTE a anon: el trigger corre como quien inserta (la landing usa la anon
-- key), y sin el grant todos los inserts de qr_scans fallarían. `logScan` no revisa la
-- respuesta, así que la falla sería silenciosa.
comment on function public.qr_scan_is_bot(text) is
  'True si el user-agent es de un crawler o generador de vistas previas (WhatsApp, Facebook, buscadores). El trigger de qr_scans les asigna channel = bot.';

-- Mapeo src -> canal. Lo que no encaja sigue cayendo en 'otro', que es la señal de que
-- alguien inventó un valor nuevo o hay una errata impresa (el `men` de Snacky).
--   share%          share y share-busqueda los genera la app (no se imprimen, así que no
--                   hay errata que proteger). También cubre el link pegado sin espacio en
--                   WhatsApp (`share¡Hola`).
--   landing-banner  canal propio `landing`: no es atribución externa, es tráfico que entra
--                   desde la propia landing a /app, pero es el origen con más volumen.
--   fb-post%        el post de Snacky del 26-ago, que no siguió la convención post-fb-.
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
    when p_src like 'sticker%'       then 'sticker'
    when p_src like 'post-ig%'       then 'post-ig'
    when p_src like 'post-fb%'       then 'post-fb'
    when p_src like 'fb-post%'       then 'post-fb'
    when p_src = 'landing-banner'    then 'landing'
    else                                  'otro'
  end
$$;

-- El canal lo decide siempre la DB: `bot` si el user-agent es de un crawler, si no se
-- deriva de `src`. Lo que mande el cliente se ignora. Así el insert público (anon) no
-- puede saltarse la red de `otro` con un canal inventado, y no importa si la landing
-- vieja (que todavía forzaba `menu-qr` y `share`) sigue viva unos minutos después del
-- push de esta migración.
create or replace function public.qr_scans_set_channel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.qr_scan_is_bot(new.user_agent) then
    new.channel := 'bot';
  else
    new.channel := public.qr_scan_channel_from_src(new.src);
  end if;
  return new;
end;
$$;

drop trigger qr_scans_set_channel_trigger on public.qr_scans;
create trigger qr_scans_set_channel_trigger
  before insert or update of src, channel, user_agent on public.qr_scans
  for each row execute function public.qr_scans_set_channel();

comment on column public.qr_scans.channel is
  'Canal por el que llegó el scan: menu-qr, sticker, share, post-ig, post-fb, landing, bot, otro. Lo pone siempre el trigger (ignora el del cliente): bot si el user-agent es de un crawler; si no, lo deriva de `src`.';

-- Recalcular todas las filas con la regla nueva. `update of channel` dispara el trigger,
-- que pisa el valor con el derivado de `src` y `user_agent`.
update public.qr_scans set channel = null;
