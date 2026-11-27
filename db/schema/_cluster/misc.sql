SELECT cron.schedule_in_database('notify-due-orders', '30 seconds', 'select public.notify_due_orders()', 'postgres', NULL, true);

SELECT cron.schedule_in_database('purge-cron-history', '17 4 * * *', 'delete from cron.job_run_details where end_time < now() - interval ''7 days''', 'postgres', NULL, true);

SELECT cron.schedule_in_database('purge-order-customer-data', '0 9 * * *', 'select public.purge_order_customer_data()', 'postgres', NULL, true);
