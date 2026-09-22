-- La primera versión exceptuaba a service_role además de postgres. Eso abría
-- una capacidad de aplicación fuera del contrato "solo admin". Se reemplaza
-- la función para que una escritura con service_role también sea rechazada.
create or replace function public.guard_business_accepts_orders_admin()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if (
    (tg_op = 'INSERT' and new.accepts_orders)
    or (tg_op = 'UPDATE' and old.accepts_orders is distinct from new.accepts_orders)
  ) and not (
    public.is_admin()
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.accepts_orders'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

comment on function public.guard_business_accepts_orders_admin() is
  'Impide que cualquier identidad de aplicación distinta de admin active o desactive pedidos. Solo exceptúa postgres para operación de infraestructura.';
