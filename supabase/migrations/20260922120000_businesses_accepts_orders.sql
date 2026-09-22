-- Separa el giro de comida del consentimiento comercial para recibir pedidos.
-- Todos nacen apagados: ningún menú existente autoriza pedidos por sí solo.
alter table public.businesses
  add column accepts_orders boolean not null default false;

comment on column public.businesses.accepts_orders is
  'True únicamente cuando el negocio aceptó recibir pedidos desde Vichente. Independiente de la categoría y de has_delivery.';

-- Reviewer puede editar el catálogo de los negocios de su municipio, pero esta
-- columna representa un acuerdo comercial. RLS acota FILAS, no columnas, así
-- que el mismo businesses_update que necesita para trabajar no basta para
-- proteger este campo: el trigger es la barrera de columna.
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
    -- `postgres` es infraestructura (migraciones/SQL editor), no una identidad
    -- de la aplicación. `service_role` sí puede usarse desde un cliente y no
    -- recibe esta excepción: el acuerdo comercial lo cambia sólo un admin.
    or current_user = 'postgres'
  ) then
    raise exception 'permission denied: only admin can change businesses.accepts_orders'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke execute on function public.guard_business_accepts_orders_admin() from public;

drop trigger if exists businesses_accepts_orders_admin_only on public.businesses;
create trigger businesses_accepts_orders_admin_only
before insert or update of accepts_orders on public.businesses
for each row execute function public.guard_business_accepts_orders_admin();

comment on function public.guard_business_accepts_orders_admin() is
  'Impide que cualquier identidad de aplicación distinta de admin active o desactive pedidos. Solo exceptúa postgres para operación de infraestructura.';
