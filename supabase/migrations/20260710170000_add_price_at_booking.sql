-- Adiciona coluna price_at_booking em appointments
-- para congelar o preço no momento do agendamento
ALTER TABLE appointments ADD COLUMN price_at_booking NUMERIC(10,2);
