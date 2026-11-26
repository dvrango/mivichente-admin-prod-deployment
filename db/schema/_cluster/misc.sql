SELECT cron.schedule_in_database('purge-order-customer-data', '0 9 * * *', 'select public.purge_order_customer_data()', 'postgres', NULL, true);
