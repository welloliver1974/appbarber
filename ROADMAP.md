# AppBarber — Roadmap & Dívidas Técnicas

> 🚨 **INSTRUÇÃO CRÍTICA PARA QUALQUER AGENTE DE IA**:
> 1. **Leia este arquivo ANTES de qualquer outra ação** ao abrir o projeto.
> 2. Siga a sequência de prioridades exatamente na ordem definida.
> 3. Após concluir cada item, marque `[ ]` → `[x]` e adicione a data.
> 4. Sempre execute `npm run build` para validar antes de passar para o próximo item.
> 5. O arquivo `FUTURE_IMPROVEMENTS.md` contém o histórico das 6 etapas anteriores (todas concluídas).

---

## 🏗️ Stack do Projeto

- **Frontend:** Vite + React 19 + TypeScript + TailwindCSS v4 + shadcn/ui
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Edge Functions, pg_cron)
- **WhatsApp:** Evolution API (self-hosted) — configurada na tabela `whatsapp_configs`
- **Deploy:** Vercel
- **Supabase Project Ref:** `chtjqqtvvlamrdesaiwp`
- **URL Supabase:** `https://chtjqqtvvlamrdesaiwp.supabase.co`
- **Timezone:** UTC-3 (Brasília) — sempre usar `America/Sao_Paulo` ou offset `-03:00`

---

## 📋 ESTADO ATUAL DO CÓDIGO (atualizado em 2026-07-10)

### O que está feito no código mas AINDA NÃO foi aplicado em produção:

As migrations abaixo foram criadas na pasta `supabase/migrations/` mas **ainda não foram executadas no Cloud do Supabase**. O banco em produção não tem essas colunas ainda.

| Migration | O que adiciona | Status Cloud |
|---|---|---|
| `20260709200000_add_buffer_minutes_to_services.sql` | `services.buffer_minutes` | ⚠️ Pendente |
| `20260709210000_reengage_cron.sql` | cron `send-reengage` | ⚠️ Pendente |
| `20260709220000_roadmap_improvements.sql` | `appointments.cancel_token`, `barbers.phone`, `whatsapp_configs.reengage_interval_days` | ⚠️ Pendente |

As Edge Functions abaixo foram **atualizadas no código** mas ainda não foram deployadas:

| Function | Status Deploy |
|---|---|
| `supabase/functions/notify-appointment/index.ts` | ⚠️ Deploy pendente |
| `supabase/functions/reengage/index.ts` | ⚠️ Deploy pendente |

---

## 🚨 FASE 0 — Deploy Pendente (FAZER ANTES DE QUALQUER CÓDIGO)

Estas ações são **manuais** e desbloquearão os bugs ativos em produção.

- [ ] **[SQL-A]** Rodar no Supabase Dashboard → SQL Editor:
  ```sql
  ALTER TABLE services
    ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0;
  ```
  > Sem isso, criar/editar serviços retorna erro 400 em produção.

- [ ] **[SQL-B]** Rodar no Supabase Dashboard → SQL Editor (migration 20260709220000):
  ```sql
  ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid();
  UPDATE appointments SET cancel_token = gen_random_uuid() WHERE cancel_token IS NULL;

  ALTER TABLE barbers
    ADD COLUMN IF NOT EXISTS phone TEXT;

  ALTER TABLE whatsapp_configs
    ADD COLUMN IF NOT EXISTS reengage_interval_days INTEGER DEFAULT 22;
  ```

- [ ] **[SQL-C]** Rodar no Supabase Dashboard → SQL Editor (cron do re-engajamento):
  ```sql
  SELECT cron.schedule(
    'send-reengage',
    '0 13 * * *',
    $$
      SELECT net.http_post(
        url    := 'https://chtjqqtvvlamrdesaiwp.supabase.co/functions/v1/reengage',
        body   := '{}'::jsonb,
        params := '{"Content-Type":"application/json"}'::jsonb
      );
    $$
  );
  ```
  > Usar URL hardcoded. A migration usa `current_setting()` que pode não existir no Cloud.

- [x] **[DEPLOY-A]** Deploy da Edge Function `notify-appointment` ✅ _2026-07-09_
  ```bash
  npx supabase functions deploy notify-appointment --project-ref chtjqqtvvlamrdesaiwp
  ```

- [x] **[DEPLOY-B]** Deploy da Edge Function `reengage` ✅ _2026-07-09_
  ```bash
  npx supabase functions deploy reengage --project-ref chtjqqtvvlamrdesaiwp
  ```

- [x] **[GIT]** Push para Vercel (auto-deploy) ✅ _2026-07-09_
  ```bash
  git push origin main
  ```
  > O commit `dda8579` já está local. Só falta o push.

---

## 🔴 FASE 1 — Bugs Críticos

### [BUG-1] Link de cancelamento no WhatsApp ✅ _código concluído em 2026-07-09_
- **Arquivo**: `supabase/functions/notify-appointment/index.ts`
- [x] Implementado — link `?token=cancel_token` injetado nas mensagens `pending` e `confirmed`
- [ ] Testado em produção (depende do DEPLOY-A da Fase 0)

### [BUG-2] Token de cancelamento seguro (`cancel_token`) ✅ _código concluído em 2026-07-09_
- **Arquivos**: `src/pages/ManageBooking.tsx` + `supabase/migrations/20260709220000_roadmap_improvements.sql`
- [x] Migration criada (`cancel_token UUID DEFAULT gen_random_uuid()` em `appointments`)
- [x] `ManageBooking.tsx` atualizado para `.eq('cancel_token', token)` em vez de `.eq('id', token)`
- [x] `notify-appointment/index.ts` usa `record.cancel_token` no link
- [ ] Migration aplicada no Cloud (ver SQL-B da Fase 0)

---

## 🟡 FASE 2 — Funcionalidades Operacionais

### [FEAT-1] Notificar o barbeiro quando cliente agenda ✅ _código concluído em 2026-07-09_
- **Arquivo**: `supabase/functions/notify-appointment/index.ts`
- [x] Coluna `phone` adicionada em `barbers` (migration + tipo TypeScript)
- [x] Edge Function dispara segunda mensagem ao barbeiro no `INSERT`
- [x] Campo de telefone do barbeiro editável em `Barbers.tsx`
- [ ] Migration aplicada no Cloud (ver SQL-B da Fase 0)
- [ ] Testado em produção

### [FEAT-2] Tela de Configurações da Loja (`ShopSettings.tsx`) ✅ _código concluído em 2026-07-09_
- **Arquivo**: `src/pages/ShopSettings.tsx`
- [x] Página criada com campos: `name`, `phone`, `address`, `logo_url`
- [x] Rota `/settings` adicionada em `App.tsx`
- [x] Item "Configurações" na sidebar (`AppLayout.tsx`)
- [x] Formulário migrado para React Hook Form + Zod (commit `0a6b0ea`)
- **Componente**: `src/components/ui/form.tsx` criado (shadcn Form sem deps externas)

### [FEAT-3] `reengage_interval_days` configurável ✅ _código concluído em 2026-07-09_
- **Arquivos**: `supabase/functions/reengage/index.ts` + `src/pages/WhatsAppSettings.tsx`
- [x] Coluna `reengage_interval_days INT DEFAULT 22` adicionada em `whatsapp_configs` (migration)
- [x] Edge Function lê o valor do banco antes de filtrar clientes inativos
- [x] Input numérico de configuração adicionado em `WhatsAppSettings.tsx`
- [ ] Migration aplicada no Cloud (ver SQL-B da Fase 0)

---

## 🟢 FASE 3 — Melhorias de Médio Prazo

### [FEAT-4] Multi-serviço no painel admin (`Appointments.tsx`)
- **Arquivos**: `src/pages/Appointments.tsx`, `src/pages/Booking.tsx`
- **Problema**: O site público já suporta múltiplos serviços, mas as telas admin usam `serviceId` singular. Inconsistência de dados.
- **Solução**: Replicar a lógica de `serviceIds[]` e `totalDuration` do `PublicSite.tsx` nestas páginas.
- [ ] `Appointments.tsx` atualizado
- [ ] `Booking.tsx` atualizado

### [FEAT-5] `price_at_booking` nos Relatórios
- **Arquivo**: `src/pages/Reports.tsx` + migration SQL
- **Problema**: O faturamento usa o preço **atual** do serviço. Se o preço mudou, o histórico fica errado.
- **Solução**:
  1. `ALTER TABLE appointments ADD COLUMN price_at_booking NUMERIC(10,2);`
  2. Em todos os fluxos de criação de agendamento, salvar `price_at_booking: selectedService.price`.
  3. Em `Reports.tsx`, usar `price_at_booking` no lugar de `services.price`.
- [ ] Migration aplicada
- [ ] Fluxos de criação atualizados (PublicSite, Appointments, Booking)
- [ ] `Reports.tsx` atualizado

### [FEAT-6] Reagendamento no `ManageBooking` (além do cancelamento)
- **Arquivo**: `src/pages/ManageBooking.tsx`
- **Problema**: O cliente só pode cancelar, não remarcar. Gera cancelamento desnecessário.
- **Solução**: Adicionar fluxo de seleção de nova data/hora (reutilizando `getAvailableSlots` de `src/lib/availability.ts`) diretamente na página `/manage`.
- [ ] Implementado

---

## 🔧 Dívidas Técnicas (código existente a corrigir)

| Item | Arquivo | Problema | Prioridade |
|---|---|---|---|
| ~~RHF + Zod~~ | ~~`ShopSettings.tsx`~~ | ~~Resolvido em `0a6b0ea`~~ | ~~Alta~~ |
| Checkmark ROADMAP | Este arquivo | Marcar checkboxes após concluir cada item | Contínua |

---

## 📊 Estado do Banco (após aplicar todas as migrations)

```
Tabelas principais:
  shops              → id, owner_user_id, public_slug, name, phone, address, logo_url,
                       instagram, working_hours, gallery_photos, hero_photo
  barbers            → shop_id, name, phone*, photo_url, bio, active
  barber_availability → barber_id, day_of_week, start_time, end_time
  services           → shop_id, name, description, duration_minutes, price, active, buffer_minutes*
  clients            → shop_id, name, phone, email, notes
  appointments       → shop_id, barber_id, client_id, service_id, start_time, end_time,
                       status, cancel_token*, notes
  whatsapp_configs   → shop_id, server_url, instance_name, api_key, active, reengage_interval_days*

* colunas adicionadas em 2026-07-09 — ainda não aplicadas no Cloud (ver Fase 0)

Edge Functions:
  notify-appointment → webhook do banco (INSERT/UPDATE de appointments)
                       envia msg ao CLIENTE e ao BARBEIRO; link de cancelamento com cancel_token
  reminder           → pg_cron a cada 15min, lembra clientes com agendamento em ~1h
  reengage           → pg_cron diário 13h UTC, re-engaja clientes inativos (intervalo configurável)

Roteamento público:
  /public/:slug              → PublicSite.tsx (wizard de agendamento em 4 etapas)
  /public/:slug/manage       → ManageBooking.tsx (cancelamento autônomo via cancel_token)
  /public/:slug?barber=ID    → PublicSite.tsx (pré-seleciona barbeiro — link de marketing)

Roteamento admin (requer auth):
  /                  → Dashboard.tsx
  /barbers           → Barbers.tsx
  /services          → Services.tsx
  /clients           → Clients.tsx
  /appointments      → Appointments.tsx
  /reports           → Reports.tsx
  /whatsapp          → WhatsAppSettings.tsx
  /settings          → ShopSettings.tsx (novo)
```

---

## 🔗 Arquivos-Chave

| Arquivo | Responsabilidade |
|---|---|
| `src/App.tsx` | Roteamento |
| `src/components/AppLayout.tsx` | Sidebar + mobile header + status WhatsApp |
| `src/lib/availability.ts` | Algoritmo de slots livres com buffer |
| `src/lib/evolution.ts` | Wrapper da Evolution API (sendText) |
| `src/lib/timezone.ts` | Utilitários UTC-3 |
| `src/lib/storage.ts` | Upload de fotos (hero, galeria, logo) via Supabase Storage |
| `src/lib/supabase.ts` | Cliente Supabase singleton |
| `src/providers/AuthProvider.tsx` | Auth state + shop ativo + `refreshShop()` |
| `supabase/functions/notify-appointment/` | Notificações WhatsApp por status + cancel_token |
| `supabase/functions/reminder/` | Lembretes 1h antes |
| `supabase/functions/reengage/` | Re-engajamento de clientes inativos (intervalo configurável) |
| `supabase/migrations/` | Histórico de migrações SQL |
| `FUTURE_IMPROVEMENTS.md` | Histórico das 6 etapas concluídas |
