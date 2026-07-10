-- AppBarber Database Schema

-- Enable pgcrypto for encrypted token storage
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Barbearias
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Barbeiros
CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Horários de trabalho do barbeiro
CREATE TABLE barber_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE(barber_id, day_of_week)
);

-- Serviços
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Associação barbeiro-serviço
CREATE TABLE barber_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(barber_id, service_id)
);

-- Clientes
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, phone)
);

-- Agendamentos
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuração WhatsApp (Evolution API)
CREATE TABLE whatsapp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  server_url TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens Google Calendar (futuro)
CREATE TABLE google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.public_booking_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id
  FROM shops
  ORDER BY created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_shop_owner(shop_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shops
    WHERE shops.id = shop_uuid
      AND shops.owner_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_shop(shop_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.is_shop_owner(shop_uuid)
    OR (auth.role() = 'anon' AND shop_uuid = public.public_booking_shop_id())
$$;

-- Políticas básicas: usuários autenticados podem ler/escrever seus próprios dados
CREATE POLICY "Users can read own shop" ON shops FOR SELECT USING (public.can_view_shop(id));
CREATE POLICY "Users can insert own shop" ON shops FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND owner_user_id = auth.uid());
CREATE POLICY "Users can update own shop" ON shops FOR UPDATE USING (public.is_shop_owner(id)) WITH CHECK (public.is_shop_owner(id));
CREATE POLICY "Users can delete own shop" ON shops FOR DELETE USING (public.is_shop_owner(id));

CREATE POLICY "Users can read shop barbers" ON barbers FOR SELECT USING (public.can_view_shop(shop_id));
CREATE POLICY "Users can insert shop barbers" ON barbers FOR INSERT WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can update shop barbers" ON barbers FOR UPDATE USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can delete shop barbers" ON barbers FOR DELETE USING (public.is_shop_owner(shop_id));

CREATE POLICY "Users can read barber availability" ON barber_availability FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_availability.barber_id
      AND public.can_view_shop(barbers.shop_id)
  )
);
CREATE POLICY "Users can insert barber availability" ON barber_availability FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_availability.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
);
CREATE POLICY "Users can update barber availability" ON barber_availability FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_availability.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_availability.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
);
CREATE POLICY "Users can delete barber availability" ON barber_availability FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_availability.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
);

CREATE POLICY "Users can read own services" ON services FOR SELECT USING (public.can_view_shop(shop_id));
CREATE POLICY "Users can insert own services" ON services FOR INSERT WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can update own services" ON services FOR UPDATE USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can delete own services" ON services FOR DELETE USING (public.is_shop_owner(shop_id));

CREATE POLICY "Users can read barber services" ON barber_services FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_services.barber_id
      AND public.can_view_shop(barbers.shop_id)
  )
  AND EXISTS (
    SELECT 1
    FROM services
    WHERE services.id = barber_services.service_id
      AND public.can_view_shop(services.shop_id)
  )
);
CREATE POLICY "Users can insert barber services" ON barber_services FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_services.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
  AND EXISTS (
    SELECT 1
    FROM services
    WHERE services.id = barber_services.service_id
      AND public.is_shop_owner(services.shop_id)
  )
);
CREATE POLICY "Users can update barber services" ON barber_services FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_services.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
  AND EXISTS (
    SELECT 1
    FROM services
    WHERE services.id = barber_services.service_id
      AND public.is_shop_owner(services.shop_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_services.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
  AND EXISTS (
    SELECT 1
    FROM services
    WHERE services.id = barber_services.service_id
      AND public.is_shop_owner(services.shop_id)
  )
);
CREATE POLICY "Users can delete barber services" ON barber_services FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM barbers
    WHERE barbers.id = barber_services.barber_id
      AND public.is_shop_owner(barbers.shop_id)
  )
  AND EXISTS (
    SELECT 1
    FROM services
    WHERE services.id = barber_services.service_id
      AND public.is_shop_owner(services.shop_id)
  )
);

CREATE POLICY "Users can read own clients" ON clients FOR SELECT USING (public.can_view_shop(shop_id));
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT WITH CHECK (
  public.is_shop_owner(shop_id)
  OR (auth.role() = 'anon' AND shop_id = public.public_booking_shop_id())
);
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE USING (public.is_shop_owner(shop_id));

CREATE POLICY "Users can read own appointments" ON appointments FOR SELECT USING (public.can_view_shop(shop_id));
CREATE POLICY "Users can insert own appointments" ON appointments FOR INSERT WITH CHECK (
  public.is_shop_owner(shop_id)
  OR (auth.role() = 'anon' AND shop_id = public.public_booking_shop_id())
);
CREATE POLICY "Users can update own appointments" ON appointments FOR UPDATE USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can delete own appointments" ON appointments FOR DELETE USING (public.is_shop_owner(shop_id));

CREATE POLICY "Users can read own whatsapp config" ON whatsapp_configs FOR SELECT USING (public.can_view_shop(shop_id));
CREATE POLICY "Users can insert own whatsapp config" ON whatsapp_configs FOR INSERT WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can update own whatsapp config" ON whatsapp_configs FOR UPDATE USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can delete own whatsapp config" ON whatsapp_configs FOR DELETE USING (public.is_shop_owner(shop_id));

CREATE POLICY "Users can read own google tokens" ON google_calendar_tokens FOR SELECT USING (public.can_view_shop(shop_id));
CREATE POLICY "Users can insert own google tokens" ON google_calendar_tokens FOR INSERT WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can update own google tokens" ON google_calendar_tokens FOR UPDATE USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Users can delete own google tokens" ON google_calendar_tokens FOR DELETE USING (public.is_shop_owner(shop_id));

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_barbers_updated_at
  BEFORE UPDATE ON barbers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_whatsapp_configs_updated_at
  BEFORE UPDATE ON whatsapp_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Edge Functions (Webhook + Cron)

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION notify_appointment_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://chtjqqtvvlamrdesaiwp.functions.supabase.co/notify-appointment',
    body := jsonb_build_object(
      'type', CASE WHEN TG_OP = 'INSERT' THEN 'INSERT' ELSE 'UPDATE' END,
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

DROP TRIGGER IF EXISTS trg_notify_appointment ON appointments;
CREATE TRIGGER trg_notify_appointment
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION notify_appointment_webhook();

SELECT cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  'SELECT net.http_post(url:=''https://chtjqqtvvlamrdesaiwp.functions.supabase.co/reminder'', headers:=''{"Content-Type": "application/json"}''::jsonb)'
);
