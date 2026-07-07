# PRD — AppBarber (SaaS para Barbearias)

## Visão Geral

SaaS para gestão de barbearias. Agendamento online, gestão de clientes/serviços/barbeiros,
notificações via WhatsApp e futura integração com Google Calendar.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 18 + TypeScript |
| Estilo | TailwindCSS + shadcn/ui |
| Backend/Dados | Supabase (Auth, PostgreSQL, Storage) |
| Notificações | Evolution API (self-hosted) |
| Deploy | Vercel |
| Timezone | UTC-3 (Brasília) — armazenamento em UTC, exibição em UTC-3 |

## Fases

### Fase 1 — Setup Inicial
- [x] Projeto Vite + React + TypeScript
- [x] TailwindCSS + shadcn/ui configurados
- [x] Dark/Light mode com persistência em localStorage
- [x] Variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- [x] Conexão com Supabase client

### Fase 2 — Core (Auth + DB + CRUD + Agendamento)
- [ ] Tabelas no Supabase (ver schema abaixo)
- [ ] Auth: email/senha
- [ ] CRUD: barbearias, barbeiros, serviços, clientes
- [ ] Fluxo de agendamento: selecionar data → barbeiro → serviço → horário
- [ ] Validação de horários disponíveis

### Fase 3 — Notificações (Evolution API)
- [ ] Evolution API self-hosted conectada ao Supabase
- [ ] Webhook do Supabase para novos agendamentos
- [ ] Lembrete automático 1h antes (job agendado)
- [ ] Confirmação de agendamento via WhatsApp

### Fase 4 — UI/UX + Responsividade
- [ ] Layout responsivo (mobile-first)
- [ ] Toast notifications
- [ ] Componentes reutilizáveis
- [ ] Consistência de timezone (UTC-3)

### Fase 5 — Deploy
- [ ] Vercel + variáveis de ambiente
- [ ] Teste de fluxo completo
- [ ] Documentação de setup local

## Schema do Banco de Dados

```sql
-- Barbearias
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  instance_name TEXT NOT NULL,
  api_key TEXT NOT NULL, -- criptografado via pgcrypto
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
```

## Fluxos Principais

### Agendamento
1. Cliente acessa link público da barbearia
2. Seleciona barbeiro → serviço → data → horário
3. Informa nome + WhatsApp (se não existir, cadastra)
4. Confirma agendamento
5. Barbearia recebe notificação via WhatsApp
6. Cliente recebe confirmação via WhatsApp
7. 1h antes: lembrete automático via WhatsApp

### Dashboard
- Visão do dia com agendamentos
- CRUD de barbeiros, serviços, agendamentos
- Histórico de clientes

## Decisões Técnicas

| Decisão | Escolha | Motivo |
|---|---|---|
| TypeScript | Sim | Tipagem segura, melhor DX |
| shadcn/ui | Sim | Tailwind nativo, dark mode, acessibilidade |
| State management | React Context + hooks | MVP leve, sem overengineering |
| Formulários | React Hook Form + Zod | Validação type-safe |
| Roteamento | React Router v6 | Padrão do ecossistema |
| Cron jobs | Supabase Edge Functions | Mesmo ecossistema, sem custo extra |
| WhatsApp | Evolution API | Não exige conta Business, self-hosted |
| Google Calendar | Pós-MVP | Complexidade adicional |

## Segurança
- Tokens do WhatsApp criptografados no banco (pgcrypto)
- RLS (Row Level Security) no Supabase habilitado
- Variáveis de ambiente para chaves sensíveis
- Refresh tokens Google Calendar armazenados com segurança

## Timezone
- Armazenamento: UTC (TIMESTAMPTZ)
- Exibição: sempre converter para UTC-3 (Brasília)
- Jobs agendados executados em UTC-3
