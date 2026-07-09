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

## 🚨 FASE 0 — Deploy Pendente (FAZER ANTES DE QUALQUER CÓDIGO)

Estas ações são **manuais** (sem código) e desbloquearão os bugs ativos.

- [ ] **[SQL-A]** Rodar no Supabase Dashboard → SQL Editor:
  ```sql
  ALTER TABLE services
    ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0;
  ```
  > Sem isso, criar/editar serviços retorna erro 400 em produção.

- [ ] **[SQL-B]** Rodar no Supabase Dashboard → SQL Editor (cron do re-engajamento):
  ```sql
  SELECT cron.unschedule('send-reengage') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'send-reengage'
  );

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
  > A migration gerada usa `current_setting()` que pode não existir no Cloud. Usar URL hardcoded acima.

- [ ] **[DEPLOY-A]** Deploy da Edge Function `notify-appointment`:
  ```bash
  npx supabase login
  npx supabase functions deploy notify-appointment --project-ref chtjqqtvvlamrdesaiwp
  ```

- [ ] **[DEPLOY-B]** Deploy da Edge Function `reengage`:
  ```bash
  npx supabase functions deploy reengage --project-ref chtjqqtvvlamrdesaiwp
  ```

- [ ] **[GIT]** Commit e push para Vercel (auto-deploy):
  ```bash
  git add -A
  git commit -m "feat: múltiplos serviços, buffer, cancelamento autônomo, re-engajamento"
  git push origin main
  ```

---

## 🔴 FASE 1 — Bugs Críticos (Alta Prioridade)

### [BUG-1] Link de cancelamento não está sendo enviado no WhatsApp
- **Arquivo**: `supabase/functions/notify-appointment/index.ts`
- **Problema**: A página `/public/:slug/manage?token=ID` existe, mas o link **nunca é enviado** nas mensagens de WhatsApp. O cliente não tem como chegar à página de cancelamento.
- **Solução**: Editar a Edge Function para injetar o link nas mensagens de status `pending` e `confirmed`.
- **Formato do link**: `https://[SITE_URL]/public/[public_slug]/manage?token=[appointment.id]`
- **Nota**: O `public_slug` da loja está na tabela `shops`. Buscar via `shop_id` do agendamento.
- [ ] Implementado
- [ ] Testado (criar agendamento e verificar se o link aparece no WhatsApp)

### [BUG-2] Token de cancelamento é o próprio `appointment.id` (risco de segurança)
- **Arquivo**: `src/pages/ManageBooking.tsx` + migration SQL
- **Problema**: Qualquer pessoa que saiba o UUID de um agendamento pode cancelá-lo. UUIDs não são secretos (aparecem em logs, webhooks etc.).
- **Solução**:
  1. Adicionar coluna `cancel_token UUID DEFAULT gen_random_uuid()` na tabela `appointments`:
     ```sql
     ALTER TABLE appointments
       ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid();
     UPDATE appointments SET cancel_token = gen_random_uuid() WHERE cancel_token IS NULL;
     ```
  2. Em `ManageBooking.tsx`, buscar por `.eq('cancel_token', token)` em vez de `.eq('id', token)`.
  3. Em `notify-appointment/index.ts`, incluir `record.cancel_token` no link (em vez do `record.id`).
- [ ] Migration aplicada
- [ ] ManageBooking.tsx atualizado
- [ ] notify-appointment.ts atualizado

---

## 🟡 FASE 2 — Funcionalidades Operacionais

### [FEAT-1] Notificar o barbeiro quando cliente agenda pelo site público
- **Arquivo**: `supabase/functions/notify-appointment/index.ts`
- **Problema**: Quando um cliente agenda pelo site público, apenas o **cliente** recebe notificação. O barbeiro só descobre na próxima vez que abrir o painel.
- **Solução**: Buscar o `phone` do barbeiro na tabela `barbers` (adicionar coluna se não existir) e disparar uma segunda mensagem quando `type === 'INSERT'`.
- **Mensagem sugerida**: `"📅 Novo agendamento! [Nome do cliente] agendou [Serviço] para [Data] às [Hora]. Acesse o painel para confirmar."`
- [ ] Coluna `phone` adicionada em `barbers` (ou já existe?)
- [ ] Implementado
- [ ] Testado

### [FEAT-2] Tela de Configurações da Loja (Shop Settings)
- **Arquivo novo**: `src/pages/ShopSettings.tsx`
- **Problema**: Não existe interface para editar nome, telefone e endereço da loja. Atualmente só via SQL.
- **Solução**: Criar página simples com formulário (React Hook Form + Zod) que faz `UPDATE` na tabela `shops`.
- **Campos**: `name`, `phone`, `address`, `logo_url`
- **Rota**: `/settings` — adicionar em `App.tsx` e `AppLayout.tsx` (sidebar item com ícone Settings).
- [ ] Página criada
- [ ] Rota adicionada
- [ ] Item na sidebar adicionado

### [FEAT-3] INACTIVE_DAYS configurável pelo admin
- **Arquivo**: `supabase/functions/reengage/index.ts` + `src/pages/WhatsAppSettings.tsx`
- **Problema**: O prazo de 22 dias está hardcoded na Edge Function. Barbearias com clientes frequentes (ex: 15 dias) ou esporádicos (ex: 30 dias) não podem ajustar.
- **Solução**:
  1. Adicionar coluna `reengage_interval_days INT DEFAULT 22` na tabela `whatsapp_configs` ou `shops`.
  2. Na Edge Function, ler esse valor via query antes de filtrar clientes inativos.
  3. Na tela WhatsAppSettings, adicionar input numérico para configurar o intervalo.
- [ ] Coluna adicionada (migration)
- [ ] Edge Function atualizada
- [ ] UI adicionada

---

## 🟢 FASE 3 — Melhorias de Médio Prazo

### [FEAT-4] Multi-serviço no painel admin (Appointments.tsx)
- **Arquivos**: `src/pages/Appointments.tsx`, `src/pages/Booking.tsx`
- **Problema**: O site público já suporta múltiplos serviços na seleção, mas as telas administrativas usam `serviceId` singular. Há inconsistência de dados entre os dois fluxos.
- **Solução**: Replicar a lógica de `serviceIds[]` e `totalDuration` do `PublicSite.tsx` nestas páginas.
- [ ] Appointments.tsx atualizado
- [ ] Booking.tsx atualizado

### [FEAT-5] price_at_booking nos Relatórios
- **Arquivo**: `src/pages/Reports.tsx` + migration SQL
- **Problema**: O faturamento usa o preço **atual** do serviço. Se o preço mudou, o histórico fica errado.
- **Solução**:
  1. `ALTER TABLE appointments ADD COLUMN price_at_booking NUMERIC(10,2);`
  2. Em todos os fluxos de criação de agendamento, salvar `price_at_booking: selectedService.price`.
  3. Em `Reports.tsx`, usar `price_at_booking` no lugar de `services.price`.
- [ ] Migration aplicada
- [ ] Fluxos de criação atualizados (PublicSite, Appointments, Booking)
- [ ] Reports.tsx atualizado

### [FEAT-6] Reagendamento no ManageBooking (além do cancelamento)
- **Arquivo**: `src/pages/ManageBooking.tsx`
- **Problema**: O cliente só pode cancelar, não remarcar. Isso gera cancelamento desnecessário quando o cliente apenas quer mudar o horário.
- **Solução**: Adicionar fluxo de seleção de nova data/hora (reutilizando `getAvailableSlots`) diretamente na página `/manage`.
- [ ] Implementado

---

## 📊 Contexto do Estado Atual do Banco

```
Tabelas principais:
  shops              → owner_user_id, public_slug, instagram, working_hours, gallery_photos, hero_photo
  barbers            → shop_id, name, photo_url, bio, active
  barber_availability → barber_id, day_of_week, start_time, end_time
  services           → shop_id, name, description, duration_minutes, price, active, buffer_minutes*
  clients            → shop_id, name, phone, email, notes
  appointments       → shop_id, barber_id, client_id, service_id, start_time, end_time, status, notes
  whatsapp_configs   → shop_id, server_url, instance_name, api_key, active

*buffer_minutes ainda não existe no Cloud — rodar SQL-A da Fase 0

Edge Functions ativas:
  notify-appointment → webhook do banco (INSERT/UPDATE de appointments)
  reminder           → pg_cron a cada 15min, lembra clientes com agendamento em ~1h
  reengage           → pg_cron diário 13h UTC, re-engaja clientes inativos 22+ dias

Roteamento público:
  /public/:slug           → PublicSite.tsx (wizard de agendamento)
  /public/:slug/manage    → ManageBooking.tsx (cancelamento autônomo)
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
| `src/lib/supabase.ts` | Cliente Supabase singleton |
| `src/providers/AuthProvider.tsx` | Auth state + shop ativo |
| `supabase/functions/notify-appointment/` | Notificações WhatsApp por status |
| `supabase/functions/reminder/` | Lembretes 1h antes |
| `supabase/functions/reengage/` | Re-engajamento de clientes inativos |
| `supabase/migrations/` | Histórico de migrações SQL |
| `FUTURE_IMPROVEMENTS.md` | Histórico das 6 etapas concluídas |
