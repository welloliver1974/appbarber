ALTER TABLE barbers ADD COLUMN IF NOT EXISTS portfolio_photos JSONB DEFAULT '[]'::jsonb;
