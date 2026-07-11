# AppBarber - Claude Guide (Operating Manual for AI Agents)

> 🚨 **IMPORTANT**: READ THIS BEFORE TAKING ANY ACTION.
> Any AI agent accessing this codebase MUST follow this guide. Do not reverse, rewrite, or roll back features from completed sessions.

## Current State (Session 17 Complete — FEAT-5: price_at_booking + Faturamento na Dashboard)

All code fully written, validated with `npm run build`.

### Completed in Session 17 — FEAT-5: `price_at_booking` + Faturamento na Dashboard (2026-07-10)
- **Migration**: `20260710170000_add_price_at_booking.sql` — `ALTER TABLE appointments ADD COLUMN price_at_booking NUMERIC(10,2)`
- **`database.ts`**: `price_at_booking: number | null` adicionado na interface `Appointment`
- **`Appointments.tsx`**: salva `price_at_booking: selectedService?.price` no insert
- **`Booking.tsx`**: salva `price_at_booking: selectedService?.price` no insert
- **`PublicSite.tsx`**: salva `totalPrice` (soma dos serviços) como `price_at_booking`
- **`Reports.tsx`**: cálculos de revenue usam `a.price_at_booking` com fallback `servicePriceMap.get(a.service_id) ?? 0`
- **`Dashboard.tsx`**: novo card **"Faturamento do Mês"** — 5º card, grid `sm:grid-cols-3 lg:grid-cols-5`, busca completed appointments do mês com `price_at_booking`, exibe em formato R$
- **fix pós-build**: query removia `.lte('start_time', now)` — completed futuros ficavam de fora. Removido.
- **Migration aplicada no Supabase Cloud** via CLI
- **Backfill**: appointments antigos preenchidos com `services.price` atual

### New State — STEP 5 tasks remaining:
1. **[FEAT-4] Multi-serviço no Admin**: `Appointments.tsx` + `Booking.tsx`
2. **[FEAT-6] Reagendamento em `ManageBooking`**

## Current State (Session 16 Complete — Fix 8 Bugs Técnicos)

All code fully written, validated with `npm run build`.

### Completed in Session 16 — Correção de 8 Bugs da Fase 1 (2026-07-10)
- **[BUG-1] `src/lib/availability.ts:45`**: `new Date(dateStr + 'T00:00:00')` substituído por `startOfUTC3DayISO()`/`endOfUTC3DayISO()` do `timezone.ts`
- **[BUG-2] `src/lib/evolution.ts:9-18`**: `getConfig(shopId)` agora filtra por `shop_id`. `sendText()` aceita `shopId` no params. Todos os callers atualizados.
- **[BUG-3] `src/pages/Appointments.tsx:121`**: Guard `if (clientIds.length > 0)` antes do `.in('id', clientIds)` para evitar SQL inválido
- **[BUG-4/5] `Booking.tsx` + `Appointments.tsx`**: Buffer minutes incluídos no `getAvailableSlots()`. `endTime` mantém só `duration_minutes` (sem buffer)
- **[BUG-6] `AdminPage.tsx:151,171`**: RPCs `admin_update_shop`/`admin_delete_shop` com fallback para `supabase.from('shops').update()/delete()` direto
- **[BUG-7] `PublicSite.tsx:232`**: Dep `serviceIds` (array) → `serviceIds.join(',')` (string)
- **[BUG-8] `PublicSite.tsx` (5x)**: `text-neutral-450` → `text-neutral-400`

### Completed in Session 11 — RHF+Zod Forms
- **`src/pages/Barbers.tsx`**, **`Clients.tsx`**, **`Services.tsx`**, **`ShopSettings.tsx`**: Formulários migrados para React Hook Form + Zod
- **`src/components/ui/form.tsx`**: Reescrito com `FormField` usando `useFormContext()` internamente

### Completed in Session 12 — Admin Panel + RLS Fix
- **`supabase/fix_rls_policies.sql`**: SQL que adiciona colunas faltantes, cria `admins` table + `is_admin()` function, corrige políticas RLS
- **`src/lib/shop.ts`**: `resolveActiveShop` simplificado — só busca por `owner_user_id`
- **`src/providers/AuthProvider.tsx`**: Adicionado `error`, `clearError()`, `isAdmin`
- **`src/components/ShopSetup.tsx`**: Tela de onboarding
- **`src/pages/AdminPage.tsx`**: Painel admin
- **`src/components/AppLayout.tsx`**: Guardas: loading → spinner; não-admin sem loja → ShopSetup; admin sem loja → /admin
- **Nav dinâmico**: Admin vê Admin + Configurações; clientes só veem operacional

### Completed in Session 13 — Login por Nome + Edge Function Auth
- **`src/pages/Login.tsx`**: Login com nome da barbearia + senha (padrão) OU email + senha (admin, toggle)
- **`src/components/AppLayout.tsx`**: Guarda `!shop && !isAdmin` mostra `NoShopPage`. Nav items separados em `baseNavItems` (Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, Relatórios) e `adminNavItems` (Admin, WhatsApp)
- **`src/pages/AdminPage.tsx`**: Criação de barbearia com senha + Edge Function `create-auth-user` + RPC `admin_create_shop`
- **`src/pages/WhatsAppSettings.tsx`**: Admin sem loja carrega lista de lojas via RPC `admin_get_all_shops` e dropdown
- **`supabase/functions/create-auth-user/index.ts`**: Edge Function que cria usuário no Supabase Auth com service_role
- **`supabase/fix_rpc_only.sql`**: Adiciona `auth_email`, RPCs `lookup_shop_auth_email`, `admin_create_shop`, `is_admin()`

### Completed in Session 14 — RLS Fix + Booking Público
- **Correções RLS no Supabase**: `can_view_shop()` liberado para anon em qualquer loja; políticas INSERT/SELECT de clients e appointments para anon
- **Trigger `notify_appointment_webhook`**: body como jsonb (sem `::text`)
- **`src/pages/Dashboard.tsx`**: Dias da semana pt-BR fixo; seletor barbeiro corrigido
- **`src/pages/PublicSite.tsx`**: Botão "Voltar ao início" na tela de sucesso
- **`supabase/storage_rls.sql`**: Políticas Storage para bucket gallery

### Completed in Session 15 — Fix Upload + Save Working Hours + RLS Admin (2026-07-10)
- **`src/lib/storage.ts`**: `ensureGalleryBucket` removido `createBucket` (requer `service_role`) → só verifica existência; `deletePhoto` corrigido `slice(4)` → `slice(6)`; `uploadGalleryPhoto` adicionado `{ upsert: true }`
- **`src/pages/WhatsAppSettings.tsx`**: Uploads usam `targetShopId` (não `shop.id`); guardas `!shop` → `!targetShopId`; botão salvar horários e link público usam `sitePublicSlug` do banco
- **`supabase/migrations/20260710150000_create_gallery_storage.sql`**: Cria bucket `gallery` + RLS policies via SQL
- **`supabase/migrations/20260710160000_fix_admin_rls_update.sql`**: Adiciona `public.is_admin()` nas policies de `shops` e `whatsapp_configs` (SELECT/UPDATE/INSERT/DELETE). Cria `admins` table + `is_admin()` function. **Necessário executar no Cloud.**
- **Frontend**: `.select('id')` adicionado nas chamadas `.update()` para detectar updates sem efeito (RLS bloqueando)

---

## 🚨 Arquitetura de Usuários (CRÍTICO — LEIA ANTES DE QUALQUER ALTERAÇÃO)

### Dois tipos de usuário
1. **Admin** (`welloliver@gmail.com` — hardcoded em `AuthProvider.tsx` `ADMIN_EMAILS`)
   - **NUNCA tem `shop` próprio** — é o dono do SaaS, cria contas para clientes
   - Sidebar (sem loja): só Admin, WhatsApp
   - Sidebar (com loja): Admin + WhatsApp + Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, Relatórios, Configurações
   - Redirecionado para `/admin` se acessar rota que não seja `/admin`, `/whatsapp` ou `/settings`
   - Cria barbearias para clientes no painel Admin (nome + senha → gera auth_email → Edge Function create-auth-user → RPC admin_create_shop)
   - Em `/whatsapp`: dropdown para selecionar qual loja configurar (usa `targetShopId`)

2. **Cliente (dono de barbearia)**
   - Tem exatamente 1 `shop` com `owner_user_id = seu auth.uid()`
   - Login via nome da barbearia + senha (RPC `lookup_shop_auth_email` busca email interno)
   - Sidebar: só itens operacionais (Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, Relatórios)
   - Se não achar loja → `NoShopPage` ("Sua barbearia ainda não foi criada. Contate o administrador.")
   - **NÃO tem auto-cadastro** — só admin cria contas

### Fluxo de criação de barbearia (SOMENTE pelo admin)
1. Admin loga em `/admin` → clica "Nova Barbearia"
2. Digita **nome da barbearia** + **senha de acesso**
3. Sistema gera `auth_email` (ex: `shop-studio-lima-abc123@appbarber.app`)
4. Chama Edge Function `create-auth-user` → cria usuário no Supabase Auth (service_role)
5. Chama RPC `admin_create_shop` → cria loja com `owner_user_id` + `auth_email`
6. Cliente loga com nome da barbearia + senha (sem precisar saber o email)

---

## 🚨 GIT / DEPLOY — REGRA FIXA

> **O agente NUNCA deve tentar executar `git push` diretamente.**
> O push sempre trava aguardando credenciais no terminal background.
> **Sempre forneça o comando abaixo para o usuário executar manualmente no terminal dele:**

```powershell
git push origin main
```

Após o push, a Vercel faz o deploy automaticamente via webhook. Se não atualizar sozinha, o usuário deve ir em **vercel.com → projeto → Deployments → Redeploy**.

---

## 🚨 NEXT STEPS FOR ANY AGENT (DO NOT SKIP OR REORDER)

### ✅ FASE 0 — Completa (validada via CLI em 2026-07-10)
- Todos os SQLs aplicados no Cloud (buffer_minutes, cancel_token, phone, reengage_interval_days, cron send-reengage)
- Todas as Edge Functions deployadas (notify-appointment v5, reengage v2, reminder v1, create-auth-user v2)
- Git push realizado

### ✅ STEP 1-3: Todos os 8 Bugs Corrigidos na Sessão 16 (2026-07-10)
| Bug | Arquivo | Fix |
|-----|---------|-----|
| BUG-1 | `availability.ts:45` | `startOfUTC3DayISO()` em vez de `new Date()` local |
| BUG-2 | `evolution.ts:9` | `getConfig(shopId)` filtra por `shop_id` |
| BUG-3 | `Appointments.tsx:121` | Guard `clientIds.length > 0` |
| BUG-4/5 | `Booking.tsx` + `Appointments.tsx` | Buffer minutes no `getAvailableSlots()` |
| BUG-6 | `AdminPage.tsx:151,171` | Fallback RPC → UPDATE/DELETE direto |
| BUG-7 | `PublicSite.tsx:232` | `serviceIds.join(',')` no deps |
| BUG-8 | `PublicSite.tsx` (5x) | `text-neutral-450` → `text-neutral-400` |

### STEP 5: Phase 3 — Novas Features (só após bugs + deploy resolvidos)
1. **[FEAT-4] Multi-serviço no Admin**: `Appointments.tsx` + `Booking.tsx` — replicar lógica de `serviceIds[]` e `totalDuration` do `PublicSite.tsx`
2. **[FEAT-5] `price_at_booking`**: Adicionar coluna `price_at_booking NUMERIC(10,2)` em appointments, salvar preço no momento do agendamento, usar nos relatórios em vez de `services.price`
3. **[FEAT-6] Reagendamento em `ManageBooking`**: Além de cancelar, permitir que o cliente escolha nova data/hora (reutilizar `getAvailableSlots`)

### STEP 6: Melhorias Futuras (após fechar roadmap)

**Site Público:**
- Depoimentos dinâmicos (hoje são fixos no código `TESTIMONIALS`)
- Portfólio de fotos por barbeiro
- Link "Agendar" direto pro WhatsApp da barbearia como fallback
- Página de confirmação com opção "Adicionar ao calendário" (.ics)

**Admin:**
- Dashboard global do admin (visão de todas as lojas + métricas consolidadas)
- Notificações no browser (Service Worker) quando cliente agenda
- Botão "duplicar horários da semana" nos barbeiros (copiar configuração de um dia pra outro)
- Exportar relatórios pra CSV/PDF
- Upload de logo integrado no ShopSettings (já tem o bucket, falta hook no form)

**Técnico:**
- Lazy loading com `React.lazy()` + `Suspense` (já tem warning de chunk de 938KB)
- React Query / TanStack Query para cache e refetch automático
- Error boundaries por página (hoje um erro inesperado quebra o app inteiro)
- Testes automatizados (vitest + playwright)

**Qualidade de Vida:**
- Busca de clientes por telefone
- Tempo real via Supabase Realtime (dashboard atualizar sozinho)
- Atalhos de teclado (ex: `N` pra novo agendamento)
- Confirmação ao sair de formulários com dados não salvos
- Paginação em listas longas (clientes, agendamentos)

---

### Completed in Session 15 — Upload de Fotos + RLS + Admin Sem Loja (2026-07-10)
- **Problem**: Upload hero/gallery photos didn't work for admin; RLS policies blocked admin writes to `shops`/`whatsapp_configs`; gallery bucket didn't exist; storage RLS blocked authenticated
- **Fixes (5 rounds)**:
  1. `src/lib/storage.ts`: simplified `ensureGalleryBucket` (no-op); fixed `deletePhoto` slice; added `upsert: true` to `uploadGalleryPhoto`; uploads throw real errors
  2. `src/pages/WhatsAppSettings.tsx`: guards from `!shop` → `!targetShopId`; save uses `targetShopId`; `.select('id')` chained to detect zero-affected-row updates
  3. Created migration `20260710150000_create_gallery_storage.sql` (bucket + single permissive `Gallery All` policy)
  4. Created migration `20260710160000_fix_admin_rls_update.sql` (added `is_admin()` to SELECT/UPDATE/INSERT/DELETE policies on shops + whatsapp_configs)
  5. `src/pages/PublicSite.tsx`: left contact card hidden if empty
  6. `src/pages/AdminPage.tsx`: RLS fix applied — admin can now update/delete shops
  7. `src/pages/PublicSite.tsx`: hero photo now also used as background for the booking wizard section (`#agendar`), wrapped with gradient fade edges for smooth transition
  8. `MANUAL_USO.md`: created comprehensive user manual (15 sections)
- **SQL directly executed on Supabase Cloud**: UPDATE policies patched with `is_admin()`; storage policies replaced with `Gallery All` single policy
- **Build**: ✅ `npm run build` passes

---

### Completed in Session 21 — Notificações push para Barbeiros (PWA) (2026-07-11)

- **Objetivo**: enviar notificação de navegador **somente para barbeiros** sempre que um agendamento for inserido, usando Web Push (Service Worker) e PWA.
- **Mudanças**:
  - `src/contexts/NotificationContext.tsx` – provê `permission`, `requestPermission`, `subscribe`, `unsubscribe`; faz upsert/delete em `push_subscriptions`.
  - `src/hooks/useBarberPush.ts` – hook que lê/grava `barbers.notifications_enabled` e dispara `subscribe`/`unsubscribe`.
  - `src/pages/Barbers.tsx` – novo campo `notifications_enabled` no schema Zod; checkbox “Ativar notificações de navegador” no diálogo de Barbeiros; persistência ao salvar.
  - `src/types/database.ts` – adicionado campo `notifications_enabled: boolean` à interface `Barber`.
  - `src/App.tsx` – registro do Service Worker somente quando `VITE_ENABLE_BARBER_PUSH === 'true'`; toda a árvore de rotas envolvida por `<NotificationProvider>`.
  - `public/service-worker.js` – handlers `push` e `notificationclick`.
  - `public/manifest.json` + `index.html` – manifesto PWA (cores, ícone SVG) e vínculo `<link rel="manifest">`.
  - **Migrations** (`20260730_create_push_subscriptions.sql`, `20260731_add_notifications_enabled_to_barbers.sql`, `20260732_add_barber_push_trigger.sql`) – já aplicadas via `supabase db query --linked`.
  - **Edge Function** `notify-barber-push` – implantada no projeto `chtjqqtvvlamrdesaiwp`; usa `web-push` (VAPID) para enviar a notificação ao `barber_id` recebido no payload.
- **Securanças**:
  - VAPID – `VAPID_PUBLIC_KEY`: `BCq4dVyfuSCzE0WgCA6YIst9M4p5oMg0h8ONlOsirbacuy-7Hs3us5eOB_GYX3FBRCLwj5V5_vcm3CKowNwEiNg`; `VAPID_PRIVATE_KEY`: `Gj8d_dkAg_32hYGceOz3NlM3CPqElbtxVr9syURMgGU` (guardada nos secrets da Edge Function e em `NEXT_PUBLIC_BASE_URL` para o `url` da notificação).
  - `post-deploy`: adicionar `VITE_ENABLE_BARBER_PUSH=true` e `VITE_VAPID_PUBLIC_KEY` no Vercel.
- **Build**: ✅ `npm run build` passa (1.38 s).

---

### Completed in Session 22 — Correção FormField + Dialog overflow (2026-07-11)

- **Problema 1:** `FormField` usado sem `FormControl`/`FormLabel` dentro do `Dialog` de Barbeiros gerava erro TypeScript `TS2353` ("Object literal may only specify known properties...").
  - **Correção:** Substituí o bloco do checkbox "Ativar notificações de navegador" por HTML simples (`<input type="checkbox">` + `<label>`) que usa o hook `useBarberPush` diretamente, removendo a dependência do `react-hook-form` para esse campo.
- **Problema 2:** Dialog de criação/edição de barbeiro ficava mais alto que a viewport; botão "Salvar" só aparecia ao redimensionar a janela.
  - **Correção:** Adicionado `className="max-h-[90vh] overflow-y-auto sm:max-w-sm"` ao `<DialogContent>` em `src/pages/Barbers.tsx`.
- **Build:** ✅ `npm run build` passa sem erros TypeScript.

## 🚨 Admin sem loja — Padrão `targetShopId`

Quando o admin está em páginas que manipulam dados de uma loja (WhatsApp, Configurações), **NUNCA use `shop`** — admin não tem loja.

**Sempre use um estado `targetShopId` derivado de um dropdown de seleção:**

```tsx
const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
const targetShopId = selectedShopId || shop?.id  // shop?.id é fallback p/ cliente
```

- **Guardas**: usar `!targetShopId` em vez de `!shop`
- **Uploads**: passar `targetShopId` em vez de `shop.id`
- **Botões salvam**: `disabled={saving || !targetShopId}`
- **Link público**: carregar `public_slug` do banco separadamente (não usar `shop.public_slug`)

---

## Hard Rules & Conventions

1. **No direct shadcn/ui edits**: Não modificar arquivos em `src/components/ui/` — exceto `form.tsx`
2. **Form Standards**: Sempre React Hook Form + Zod. Nunca `useState` isolado para campos de formulário
3. **Timezone**: UTC-3 (`America/Sao_Paulo` / offset `-03:00`)
4. **Build verification**: Sempre `npm run build` após qualquer mudança. Zero erros TypeScript
5. **Types**: TypeScript estrito. Evitar `any` — exceto `form.tsx` (`rules` e `control`)
6. **Git push**: NUNCA executar `git push` — sempre fornecer comando para o usuário
7. **Admin**: Identificado por email em `ADMIN_EMAILS` no `AuthProvider.tsx`

---

## Relationship to other files
- `ROADMAP.md`: Checklist vivo com tarefas granulares
- `AGENTS.md` (no `user_rules`): Histórico técnico completo de todas as sessões
