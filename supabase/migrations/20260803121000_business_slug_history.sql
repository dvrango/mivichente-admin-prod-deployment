-- Historial de slugs: un slug que ya salió impreso no se puede cambiar.
--
-- Los QR del menú llevan la ruta corta (vichente.com/<slug>/menu) impresa en un
-- display de mesa. Si el negocio se renombra, `businesses_set_slug_trigger`
-- recalcula el slug y el papel pegado en la mesa apunta a un 404 — y no hay
-- forma de avisarle a quien ya lo tiene. Esta tabla guarda los slugs viejos para
-- poder redirigir en vez de romper.

create table public.business_slug_history (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug        text not null,
  replaced_at timestamptz not null default now()
);

-- Un slug viejo apunta a un solo negocio: si dos lo reclaman, el redirect sería
-- ambiguo y el QR impreso mandaría a cualquiera de los dos.
create unique index business_slug_history_slug_key
  on public.business_slug_history (slug);
create index business_slug_history_business_idx
  on public.business_slug_history (business_id);

create or replace function public.businesses_record_old_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug and coalesce(old.slug, '') <> '' then
    -- El slug que acaba de tomar este negocio deja de ser histórico de nadie:
    -- lo vivo siempre gana sobre lo archivado.
    delete from public.business_slug_history where slug = new.slug;

    insert into public.business_slug_history (business_id, slug)
    values (old.id, old.slug)
    on conflict (slug) do update
      set business_id = excluded.business_id,
          replaced_at = now();
  end if;
  return new;
end;
$$;

create trigger businesses_record_old_slug_trigger
  after update of slug on public.businesses
  for each row execute function public.businesses_record_old_slug();

-- La landing resuelve el redirect con la anon key, sin sesión.
alter table public.business_slug_history enable row level security;

create policy "business_slug_history_public_read"
  on public.business_slug_history
  for select
  to anon, authenticated
  using (true);

grant select on public.business_slug_history to anon, authenticated;
