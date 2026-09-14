-- Dos correcciones a 20260914120000, salidas del audit de cobertura.
--
-- 1. El `grant execute` de is_food no acotaba nada.
--
-- Postgres le da EXECUTE a PUBLIC por default en toda función nueva. Como nadie
-- lo revocó, el ACL quedó `{=X/postgres, ...}` — ese `=X` es PUBLIC, así que la
-- función la puede ejecutar cualquier rol presente o futuro, incluido `pending`.
-- El grant a anon/authenticated era decorativo y el comentario del commit decía
-- que era una acotación. Se revoca de PUBLIC para que el grant signifique lo que
-- dice.
--
-- Nota: is_staff(), is_admin() y can_edit_business() tienen el mismo hueco. No se
-- tocan aquí para no meter cambios de autorización no pedidos en una migración
-- que va por otra cosa; queda anotado como deuda conocida.
revoke execute on function public.is_food(public.businesses) from public;
grant execute on function public.is_food(public.businesses) to anon, authenticated, service_role;

-- 2. El resync reescribía filas que no cambiaban.
--
-- `update businesses set services_label = services_label where category_id = ...`
-- tocaba TODAS las filas de la categoría sin comparar contra el valor nuevo.
-- Efectos medidos en local sobre una categoría con 7 negocios: los 7 quedaron
-- con `updated_at = now()` —porque businesses_set_updated_at es BEFORE UPDATE
-- sobre todas las columnas— aunque su label terminara idéntico. O sea que editar
-- el tipo de una categoría re-fechaba en silencio a todos sus negocios, y dejaba
-- N tuplas muertas por nada.
--
-- El guard compara contra el label que corresponde al `type` nuevo, así que solo
-- se escriben las filas que de verdad cambian. Como el UPDATE sigue metiendo
-- `services_label` en la lista de columnas actualizadas, el trigger BEFORE de
-- businesses se sigue disparando sobre esas filas y calcula el valor final.
create or replace function public.resync_services_label_on_category_type()
returns trigger
language plpgsql
as $function$
declare
  label_nuevo text;
begin
  label_nuevo := case when new.type = 'food' then 'Menú' else 'Servicios' end;

  update public.businesses
     set services_label = services_label
   where category_id = new.id
     and services_label is distinct from label_nuevo;

  return null;
end;
$function$;
