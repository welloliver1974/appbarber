-- 1. [BUG-2] Add cancel_token to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid();
UPDATE appointments SET cancel_token = gen_random_uuid() WHERE cancel_token IS NULL;

-- 2. [FEAT-1] Add phone to barbers
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. [FEAT-3] Add reengage_interval_days to whatsapp_configs
ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS reengage_interval_days INT DEFAULT 22;
