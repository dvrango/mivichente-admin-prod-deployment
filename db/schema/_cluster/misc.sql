SELECT cron.schedule_in_database('notify-due-orders', '30 seconds', 'select public.notify_due_orders()', 'postgres', NULL, true);

SELECT cron.schedule_in_database('purge-order-customer-data', '0 9 * * *', 'select public.purge_order_customer_data()', 'postgres', NULL, true);
