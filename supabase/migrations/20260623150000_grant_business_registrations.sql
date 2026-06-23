-- anon puede insertar solicitudes (INSERT only, no SELECT)
GRANT INSERT ON public.business_registrations TO anon;

-- admin (authenticated) tiene acceso completo
GRANT ALL ON public.business_registrations TO authenticated;
