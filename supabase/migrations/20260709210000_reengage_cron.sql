-- Agendar re-engajamento automático diário (às 10h00 horário de Brasília = 13h UTC)
-- Execute este SQL no Supabase Dashboard > SQL Editor

-- 1. Garantir que pg_cron e pg_net estejam habilitados (já devem estar da sessão 4)
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;

-- 2. Remover job antigo caso exista (idempotente)
SELECT cron.unschedule('send-reengage')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-reengage'
);

-- 3. Criar o job diário às 10h Brasília (13h UTC)
SELECT cron.schedule(
  'send-reengage',
  '0 13 * * *',
  $$
    SELECT net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/reengage',
      body   := '{}'::jsonb,
      params := '{"Content-Type":"application/json"}'::jsonb
    );
  $$
);
