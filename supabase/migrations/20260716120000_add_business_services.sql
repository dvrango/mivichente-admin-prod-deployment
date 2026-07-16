-- business_services: servicios con nombre y precio que ofrece un negocio.
--
-- Motivación: negocios de servicio (ej. SB Nutrición) publican una lista de
-- servicios/paquetes con precio propio — "Consulta $500", "Paquete Full Fit
-- $1900". Eso no cabía en el schema: `businesses.description` es texto libre y
-- `businesses.offerings` es text[] de capacidades genéricas sin precio
-- ("acompañamiento nutricional"), pensado para búsqueda, no para mostrar
-- una lista con costos.
--
-- Alcance deliberado: sólo nombre + precio + descripción. El "qué incluye" de
-- cada servicio vive en `description` como texto — no se modela como tabla
-- aparte porque nada necesita consultar esos ítems por separado. Tampoco hay
-- `duration_minutes`: ningún negocio actual agenda por horario fijo; se agrega
-- como columna nullable cuando entre un giro que lo pida (lashista, barbería).

create table public.business_services (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  -- nullable: hay servicios sin precio público ("cotiza tu evento").
  price       numeric(10, 2),
  description text,
  -- orden de despliegue definido desde el admin; empates se rompen por nombre.
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Lookup por negocio (el perfil carga todos los servicios de un business_id).
create index business_services_business_id_idx
  on public.business_services (business_id, order_index);

-- RLS: mismo patrón que business_hours — anon sólo ve servicios de negocios
-- activos, authenticated (admin) tiene acceso total.
alter table public.business_services enable row level security;

create policy "business_services_public_read"
  on public.business_services for select
  to anon
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_services.business_id
        and b.is_active = true
    )
  );

create policy "business_services_admin_all"
  on public.business_services for all
  to authenticated
  using (true)
  with check (true);

-- Las policies no bastan sin el grant a nivel tabla (mismo requisito que
-- business_hours y business_categories).
grant select on public.business_services to anon;
grant all on public.business_services to authenticated;
