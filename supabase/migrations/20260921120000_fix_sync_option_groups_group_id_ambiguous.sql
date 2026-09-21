-- Corrige la colisión entre la variable PL/pgSQL `group_id` y la columna
-- homónima de `business_service_options`. La ambigüedad impedía guardar un
-- platillo que ya tuviera grupos de opciones.

-- La RPC también valida las invariantes de captura para que un cliente
-- autenticado que la invoque directamente no pueda saltarse el formulario.
create or replace function public.sync_business_service_option_groups(
  p_service_id uuid,
  p_groups jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $function$
declare
  service_business_id uuid;
  group_record jsonb;
  option_record jsonb;
  current_group_id uuid;
  option_id uuid;
  group_index integer;
  option_index integer;
  expected bigint;
  affected bigint;
  actor_id uuid;
begin
  actor_id := auth.uid();
  if jsonb_typeof(p_groups) <> 'array' then
    raise exception 'Los grupos de opciones deben ser una lista.';
  end if;
  if jsonb_array_length(p_groups) > 20 then
    raise exception 'Demasiados grupos de opciones para un solo platillo.';
  end if;

  if exists (
    select 1
      from (
        select lower(regexp_replace(trim(item->>'name'), '\s+', ' ', 'g')) as name_key
          from jsonb_array_elements(p_groups) item
      ) names
     where names.name_key = ''
  ) then
    raise exception 'Cada grupo de opciones necesita un nombre.';
  end if;

  if exists (
    select 1
      from (
        select lower(regexp_replace(trim(item->>'name'), '\s+', ' ', 'g')) as name_key
          from jsonb_array_elements(p_groups) item
      ) names
     group by names.name_key
    having count(*) > 1
  ) then
    raise exception 'Hay dos grupos de opciones con el mismo nombre.';
  end if;

  select business_id
    into service_business_id
    from public.business_services
   where id = p_service_id;

  if service_business_id is null then
    raise exception 'Ese platillo no existe.';
  end if;

  -- Validar todos los ids antes de borrar o actualizar algo. Así un payload
  -- viejo o manipulado falla sin dejar un estado intermedio.
  select count(*)
    into expected
    from jsonb_array_elements(p_groups) item
   where nullif(item->>'id', '') is not null;

  select count(*)
    into affected
    from public.business_service_option_groups g
   where g.service_id = p_service_id
     and g.id in (
       select (item->>'id')::uuid
         from jsonb_array_elements(p_groups) item
        where nullif(item->>'id', '') is not null
     );

  if affected <> expected then
    raise exception 'Uno de los grupos de opciones ya no existe.';
  end if;

  for group_record, group_index in
    select value, (ordinality - 1)::integer
      from jsonb_array_elements(p_groups) with ordinality
  loop
    if jsonb_typeof(group_record->'options') <> 'array' then
      raise exception 'Las opciones de cada grupo deben ser una lista.';
    end if;
    if jsonb_array_length(group_record->'options') > 30 then
      raise exception 'Demasiadas opciones para un solo grupo.';
    end if;

    if (group_record->>'min_select')::integer >= 1
       and jsonb_array_length(group_record->'options') = 0 then
      raise exception 'Un grupo obligatorio necesita al menos una opción.';
    end if;

    if nullif(group_record->>'max_select', '') is not null
       and (group_record->>'max_select')::integer > jsonb_array_length(group_record->'options') then
      raise exception 'El máximo de opciones no puede superar las opciones capturadas.';
    end if;

    if exists (
      select 1
        from (
          select lower(regexp_replace(trim(item->>'name'), '\s+', ' ', 'g')) as name_key
            from jsonb_array_elements(group_record->'options') item
        ) names
       where names.name_key = ''
    ) then
      raise exception 'Cada opción necesita un nombre.';
    end if;

    if exists (
      select 1
        from (
          select lower(regexp_replace(trim(item->>'name'), '\s+', ' ', 'g')) as name_key
            from jsonb_array_elements(group_record->'options') item
        ) names
       group by names.name_key
      having count(*) > 1
    ) then
      raise exception 'Un grupo no puede tener opciones con el mismo nombre.';
    end if;

    current_group_id := nullif(group_record->>'id', '')::uuid;

    if current_group_id is not null then
      select count(*)
        into expected
        from jsonb_array_elements(group_record->'options') item
       where nullif(item->>'id', '') is not null;

      select count(*)
        into affected
        from public.business_service_options o
       where o.group_id = current_group_id
         and o.id in (
           select (item->>'id')::uuid
             from jsonb_array_elements(group_record->'options') item
            where nullif(item->>'id', '') is not null
         );

      if affected <> expected then
        raise exception 'Una de las opciones ya no existe.';
      end if;
    else
      if exists (
        select 1
          from jsonb_array_elements(group_record->'options') item
         where nullif(item->>'id', '') is not null
      ) then
        raise exception 'Una opción nueva no puede traer id.';
      end if;
    end if;
  end loop;

  -- El borrado ocurre primero dentro de la transacción, no puede quedar
  -- separado de los updates/inserts que siguen. La cantidad afectada detecta
  -- el rechazo silencioso de UPDATE/DELETE bajo RLS.
  with incoming as (
    select (item->>'id')::uuid as id
      from jsonb_array_elements(p_groups) item
     where nullif(item->>'id', '') is not null
  )
  select count(*)
    into expected
    from public.business_service_option_groups g
   where g.service_id = p_service_id
     and not exists (select 1 from incoming where incoming.id = g.id);

  with incoming as (
    select (item->>'id')::uuid as id
      from jsonb_array_elements(p_groups) item
     where nullif(item->>'id', '') is not null
  )
  delete from public.business_service_option_groups g
   where g.service_id = p_service_id
     and not exists (select 1 from incoming where incoming.id = g.id);
  get diagnostics affected = row_count;
  if affected <> expected then
    raise exception 'No se pudieron borrar todos los grupos de opciones.';
  end if;

  for group_record, group_index in
    select value, (ordinality - 1)::integer
      from jsonb_array_elements(p_groups) with ordinality
  loop
    current_group_id := nullif(group_record->>'id', '')::uuid;

    if current_group_id is not null then
      update public.business_service_option_groups as g
         set name = group_record->>'name',
             min_select = (group_record->>'min_select')::integer,
             max_select = nullif(group_record->>'max_select', '')::integer,
             order_index = group_index,
             updated_at = now(),
             updated_by = actor_id
       where g.id = current_group_id
         and g.service_id = p_service_id;
      get diagnostics affected = row_count;
      if affected <> 1 then
        raise exception 'No se pudo actualizar un grupo de opciones.';
      end if;
    else
      insert into public.business_service_option_groups (
        service_id, business_id, name, min_select, max_select, order_index,
        created_by, updated_by
      ) values (
        p_service_id,
        service_business_id,
        group_record->>'name',
        (group_record->>'min_select')::integer,
        nullif(group_record->>'max_select', '')::integer,
        group_index,
        actor_id,
        actor_id
      ) returning id into current_group_id;
    end if;

    with incoming as (
      select (item->>'id')::uuid as id
        from jsonb_array_elements(group_record->'options') item
       where nullif(item->>'id', '') is not null
    )
    select count(*)
      into expected
      from public.business_service_options o
     where o.group_id = current_group_id
       and not exists (select 1 from incoming where incoming.id = o.id);

    with incoming as (
      select (item->>'id')::uuid as id
        from jsonb_array_elements(group_record->'options') item
       where nullif(item->>'id', '') is not null
    )
    delete from public.business_service_options o
     where o.group_id = current_group_id
       and not exists (select 1 from incoming where incoming.id = o.id);
    get diagnostics affected = row_count;
    if affected <> expected then
      raise exception 'No se pudieron borrar todas las opciones.';
    end if;

    for option_record, option_index in
      select value, (ordinality - 1)::integer
        from jsonb_array_elements(group_record->'options') with ordinality
    loop
      option_id := nullif(option_record->>'id', '')::uuid;

      if option_id is not null then
        update public.business_service_options as o
           set name = option_record->>'name',
               price_delta = (option_record->>'price_delta')::numeric,
               order_index = option_index,
               updated_at = now(),
               updated_by = actor_id
         where o.id = option_id
           and o.group_id = current_group_id;
        get diagnostics affected = row_count;
        if affected <> 1 then
          raise exception 'No se pudo actualizar una opción.';
        end if;
      else
        insert into public.business_service_options (
          group_id, business_id, name, price_delta, order_index,
          created_by, updated_by
        ) values (
          current_group_id,
          service_business_id,
          option_record->>'name',
          (option_record->>'price_delta')::numeric,
          option_index,
          actor_id,
          actor_id
        );
      end if;
    end loop;
  end loop;

  return true;
end;
$function$;

revoke all on function public.sync_business_service_option_groups(uuid, jsonb) from public;
grant execute on function public.sync_business_service_option_groups(uuid, jsonb) to authenticated;
