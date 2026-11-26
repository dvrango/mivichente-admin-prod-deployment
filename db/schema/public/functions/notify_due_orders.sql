CREATE OR REPLACE FUNCTION public.notify_due_orders()
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_url   text;
  v_count integer := 0;
  v_order record;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s
   where s.name = 'orders_notify_url';

  if v_url is null or btrim(v_url) = '' then
    return 0;
  end if;

  for v_order in
    select o.token
      from public.orders o
     where o.status = 'pending'
       and o.notify_status = 'pending'
       and o.created_at <= now() - interval '15 seconds'
       and o.created_at > now() - interval '10 minutes'
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('token', v_order.token),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 20000
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."notify_due_orders"() TO "postgres";

COMMENT ON FUNCTION "public"."notify_due_orders"() IS 'Pide el aviso al restaurante de cada pedido pendiente con el aviso pendiente, creado hace más de 15 s (la ventana para cambiarlo) y menos de 10 min. Llama la ruta del admin guardada en Vault como orders_notify_url con pg_net; sin ella no hace nada. La ruta es idempotente, así que repetirla no manda dos avisos. Devuelve cuántos pidió. La corre pg_cron cada 30 s (job notify-due-orders); solo postgres.';

REVOKE ALL ON FUNCTION "public"."notify_due_orders"() FROM PUBLIC;
