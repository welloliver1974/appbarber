# AppBarber - Claude Guide (Operating Manual for AI Agents)

> 🚨 **IMPORTANT**: READ THIS BEFORE TAKING ANY ACTION.
> Any AI agent accessing this codebase MUST follow this guide. Do not reverse, rewrite, or roll back features from completed sessions.

## Current State (Session 15 Complete — Fix Upload + Save Working Hours)

All code fully written, validated with `npm run build`, and pushed to GitHub (`origin/main`).

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

### STEP 1: SQL Pendente no Cloud (ROADMAP.md Fase 0)
Verificar se o usuário já executou as migrações SQL pendentes:
- `buffer_minutes` em services
- `cancel_token` em appointments
- `phone` em barbers
- `reengage_interval_days` em whatsapp_configs
- Cron `send-reengage`
Se não: pedir para executar no Supabase Dashboard → SQL Editor.

### STEP 2: Edge Functions — Deploy Pendente
- `notify-appointment`: precisa rodar `npx supabase functions deploy notify-appointment --project-ref chtjqqtvvlamrdesaiwp`
- `reengage`: precisa rodar `npx supabase functions deploy reengage --project-ref chtjqqtvvlamrdesaiwp`

### STEP 3: Bugs Conhecidos (corrigir em ordem)
1. **[CRITICAL] RLS: UPDATE policies sem `is_admin()`** — Migration `20260710160000_fix_admin_rls_update.sql` precisa ser executada. Sem ela, admin não consegue salvar working_hours, whatsapp_config, nem qualquer UPDATE via REST API. O Supabase retorna sucesso (0 linhas) sem erro. ✅ _migration criada, falta executar no Cloud_
2. **[CRITICAL] `src/lib/availability.ts:45-46`** — `new Date(dateStr + 'T00:00:00')` usa timezone local do browser, não UTC-3. Quebra disponibilidade para usuários fora do fuso -03.
3. **[CRITICAL] `src/lib/evolution.ts:9-18`** — `getConfig()` retorna primeira config ativa ignorando shop_id. Todas as lojas compartilham mesma instância WhatsApp.
4. **[HIGH] `src/pages/Appointments.tsx:121`** — `clientIds` vazio crasha Supabase (`.in('id', [])`).
5. **[HIGH] `src/pages/Booking.tsx:96,148`** — Buffer minutes ignorados na verificação de disponibilidade.
6. **[HIGH] `src/pages/Appointments.tsx:73`** — Buffer minutes ignorados na verificação de disponibilidade.
7. **[MEDIUM] `src/pages/AdminPage.tsx`** — RPCs `admin_update_shop`/`admin_delete_shop` podem não existir no banco.
8. **[MEDIUM] `src/pages/PublicSite.tsx:232`** — `serviceIds` array no deps causa re-fetch infinito.
9. **[MEDIUM] `src/pages/PublicSite.tsx`** — Classes Tailwind inválidas `text-neutral-450`.

### STEP 4: Phase 3 — Novas Features (só após bugs críticos resolvidos)
1. **[FEAT-4] Multi-serviço no Admin**: `Appointments.tsx` + `Booking.tsx` — múltiplos serviços por agendamento
2. **[FEAT-5] `price_at_booking`**: Histórico de preços nos relatórios
3. **[FEAT-6] Reagendamento em `ManageBooking`**: Autosserviço pelo cliente

---

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
