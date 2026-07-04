-- Autoría de negocios: saber quién dio de alta y quién modificó por última vez.
-- Opción mínima (sin historial de cambios previos, eso sería un audit_log aparte).
-- Plan: 08 Execution/plans/Roles en admin panel.md (audit log queda fuera de v1;
-- esto es el paso intermedio "quién", pedido explícitamente).

-- ============================================================
-- profiles.email: para que el admin resuelva "quién" sin tocar auth.users
-- ============================================================

alter table public.profiles add column if not exists email text;

-- Backfill desde auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- El trigger de signup ahora también copia el email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- El admin necesita leer TODOS los perfiles para mapear created_by/updated_by
-- a un email. (profiles_select_own sigue existiendo; ambas policies OR-ean.)
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- ============================================================
-- businesses.created_by / updated_by
-- ============================================================

alter table public.businesses
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;
