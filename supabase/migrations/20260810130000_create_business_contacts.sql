-- business_contacts: el escalón del embudo que hoy no se ve.
--
-- search_events dice qué se buscó, search_result_taps qué perfil se abrió.
-- Ahí se acababa la instrumentación — el paso donde el directorio entrega
-- valor real (que alguien le llame, le escriba o llegue al negocio) no
-- quedaba registrado en ningún lado. Es una meta que el propio PRD se puso
-- ("al menos 1 llamada por sesión activa") sin instrumentación detrás.
--
-- Mismo patrón que search_result_taps: device_id anónimo para poder excluir
-- el uso propio y cruzar actividad del mismo dispositivo, sin construir un
-- perfil de quién contacta a quién (atribución por canal, no por persona —
-- Decision Log, "Atribución por canal sí, rastreo por persona no").
--
-- `source` distingue el cliente Flutter (nativo Android + web app en
-- app.vichente.com, mismo binario) de la landing (vichente.com, Next.js) —
-- son dos superficies con implementaciones de contacto independientes.

create table public.business_contacts (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel     text not null,
  source      text not null,
  created_at  timestamptz not null default now(),
  constraint business_contacts_channel_check check (channel in ('call', 'whatsapp', 'maps')),
  constraint business_contacts_source_check check (source in ('app', 'landing'))
);

comment on column public.business_contacts.channel is
  'Por qué medio se contactó: call, whatsapp o maps. Se registra la intención (tap del botón), no si la llamada/el mensaje se completó.';
comment on column public.business_contacts.source is
  'app = cliente Flutter (nativo Android + web app en app.vichente.com). landing = vichente.com (Next.js), implementación de contacto independiente.';

create index business_contacts_business_created_idx
  on public.business_contacts (business_id, created_at desc);
create index business_contacts_channel_created_idx
  on public.business_contacts (channel, created_at desc);

alter table public.business_contacts enable row level security;

-- Mismo patrón que qr_scans / search_result_taps: cualquier visitante,
-- incluso anónimo, dispara el insert al tocar el botón.
create policy "anyone can log a contact"
  on public.business_contacts
  for insert
  to anon, authenticated
  with check (true);

grant insert on public.business_contacts to anon, authenticated;
