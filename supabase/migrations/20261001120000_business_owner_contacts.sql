-- Datos del dueño fuera de la lectura pública (tarea yekdqmi27).
--
-- `businesses.owner`, `owner_phone` y `owner_contact_note` se podían leer con la
-- anon key: `businesses_public_read` filtra filas (is_active) pero no columnas,
-- y la app hace `select('*')` y las RPC `search_businesses` /
-- `businesses_open_now` regresan `setof businesses`. El teléfono del dueño es
-- personal, no el del negocio.
--
-- Por qué tabla aparte y no un REVOKE por columna: PostgREST expande `select=*`
-- a todas las columnas y truena con "permission denied" si una no está
-- concedida, y lo mismo las RPC `setof businesses`. Eso rompería la app que ya
-- está en Play. Sacando las columnas de `businesses`, `*` y las RPC siguen
-- funcionando igual y la privacidad queda en RLS.
--
-- Esta migración NO borra nada: crea la tabla, copia los datos y deja un
-- trigger puente que espeja en la tabla nueva cualquier escritura que el admin
-- viejo haga sobre las columnas viejas mientras se despliega el admin nuevo.
-- La migración siguiente (…_drop_business_owner_columns) quita el puente y las
-- columnas. Orden en prod: db:push (esta) → deploy del admin → db:push (la otra).

create table public.business_owner_contacts (
  business_id        uuid primary key references public.businesses(id) on delete cascade,
  owner              text,
  owner_phone        text,
  owner_contact_note text,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles(id) on delete set null
);

comment on table public.business_owner_contacts is
  'Contacto interno del dueño de cada negocio (campaña de campo). Solo staff: nunca se expone a anon.';
comment on column public.business_owner_contacts.owner is
  'Nombre del dueño del negocio. Uso interno (campaña de campo), no se muestra en la app.';
comment on column public.business_owner_contacts.owner_phone is
  'Teléfono de contacto del dueño/encargado, 10 dígitos sin formato. Uso interno.';
comment on column public.business_owner_contacts.owner_contact_note is
  'Quién es el contacto real ("hija del dueño, lleva el FB"). Texto libre corto.';

-- updated_at / updated_by se sellan en la DB: así no dependen de que cada
-- escritor del admin se acuerde de mandarlos.
create or replace function public.business_owner_contacts_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger business_owner_contacts_stamp
  before insert or update on public.business_owner_contacts
  for each row execute function public.business_owner_contacts_stamp();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mismo criterio que `businesses_update`: el admin todo, el reviewer solo los
-- negocios de su municipio. La lectura también va acotada por municipio (más
-- estricta que `businesses_select`): un reviewer no necesita el teléfono
-- personal del dueño de un negocio que no puede editar.
alter table public.business_owner_contacts enable row level security;

-- Supabase hereda grants amplios por default privileges. Se revocan todos y se
-- concede solo a `authenticated`: anon no tiene ni grant ni policy.
revoke all on public.business_owner_contacts from anon, authenticated;
grant select, insert, update, delete on public.business_owner_contacts to authenticated;

create policy business_owner_contacts_select
  on public.business_owner_contacts
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.municipio = public.user_municipio()
    )
  );

create policy business_owner_contacts_insert
  on public.business_owner_contacts
  for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.municipio = public.user_municipio()
    )
  );

create policy business_owner_contacts_update
  on public.business_owner_contacts
  for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.municipio = public.user_municipio()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.municipio = public.user_municipio()
    )
  );

create policy business_owner_contacts_delete
  on public.business_owner_contacts
  for delete
  to authenticated
  using (public.is_admin());

-- ── Copia de los datos existentes ────────────────────────────────────────────
-- Solo filas con algún dato no vacío; las vacías no aportan nada.
insert into public.business_owner_contacts (business_id, owner, owner_phone, owner_contact_note, updated_by)
select
  b.id,
  nullif(trim(b.owner), ''),
  nullif(trim(b.owner_phone), ''),
  nullif(trim(b.owner_contact_note), ''),
  b.updated_by
from public.businesses b
where coalesce(trim(b.owner), '') <> ''
   or coalesce(trim(b.owner_phone), '') <> ''
   or coalesce(trim(b.owner_contact_note), '') <> '';

-- ── Puente temporal (se borra en la migración siguiente) ─────────────────────
-- Entre este db:push y el deploy del admin nuevo, el admin viejo sigue
-- escribiendo `businesses.owner*`. Sin el puente, esas ediciones se perderían
-- al borrar las columnas. SECURITY DEFINER porque solo espeja lo que el mismo
-- usuario ya escribió en `businesses` y pasó su RLS.
create or replace function public.mirror_business_owner_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.owner is not distinct from old.owner
     and new.owner_phone is not distinct from old.owner_phone
     and new.owner_contact_note is not distinct from old.owner_contact_note then
    return null;
  end if;

  if tg_op = 'INSERT'
     and coalesce(trim(new.owner), '') = ''
     and coalesce(trim(new.owner_phone), '') = ''
     and coalesce(trim(new.owner_contact_note), '') = '' then
    return null;
  end if;

  insert into public.business_owner_contacts (business_id, owner, owner_phone, owner_contact_note)
  values (
    new.id,
    nullif(trim(new.owner), ''),
    nullif(trim(new.owner_phone), ''),
    nullif(trim(new.owner_contact_note), '')
  )
  on conflict (business_id) do update
    set owner = excluded.owner,
        owner_phone = excluded.owner_phone,
        owner_contact_note = excluded.owner_contact_note;
  return null;
end;
$$;

revoke all on function public.mirror_business_owner_columns() from public, anon, authenticated;

create trigger businesses_mirror_owner_columns
  after insert or update of owner, owner_phone, owner_contact_note on public.businesses
  for each row execute function public.mirror_business_owner_columns();
