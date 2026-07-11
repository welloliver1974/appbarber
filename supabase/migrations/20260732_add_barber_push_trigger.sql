-- Trigger to notify barber via push on new appointment insertion
CREATE OR REPLACE FUNCTION public.notify_barber_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://chtjqqtvvlamrdesaiwp.functions.supabase.co/notify-barber-push',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'appointments',
      'record', jsonb_build_object(
        'id', NEW.id,
        'shop_id', NEW.shop_id,
        'barber_id', NEW.barber_id,
        'client_id', NEW.client_id,
        'service_id', NEW.service_id,
        'start_time', NEW.start_time,
        'status', NEW.status
      )
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_barber_push ON public.appointments;
CREATE TRIGGER trg_notify_barber_push
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_barber_push();
