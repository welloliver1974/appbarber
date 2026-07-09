# AppBarber - Claude Guide (Operating Manual for AI Agents)

> 🚨 **IMPORTANT**: READ THIS BEFORE TAKING ANY ACTION.
> Any AI agent accessing this codebase MUST follow this guide. Do not reverse, rewrite, or roll back features from completed sessions.

## Current State (Session 11 Complete)

All code for Phase 1, 2 & Item 4 (RHF+Zod forms) is fully written, validated with `npm run build`, and pushed to GitHub (`origin/main`, commit `4ba3230`).

### Completed in Session 11
- **`src/pages/Barbers.tsx`**: Formulário de cadastro/edição migrado para React Hook Form + Zod (nome e telefone do WhatsApp com validação).
- **`src/pages/Clients.tsx`**: Formulário migrado para RHF + Zod (nome, WhatsApp, email, notas).
- **`src/components/ui/form.tsx`**: Reescrito com `FormField` usando `useFormContext()` internamente para evitar conflito de generics do `react-hook-form` v7+ com `zodResolver`. A prop `control` é aceita mas ignorada (compat. de API). A prop `rules` é tipada como `any`.
- **`src/pages/Services.tsx`**: Corrigido `.default('0')` no schema Zod de `buffer_minutes` (eliminava divergência input/output no resolver); removido `asChild` do `DialogTrigger`.
- **`supabase/fix_rls_policies.sql`**: SQL de correção RLS (permitir SELECT/UPDATE de lojas sem dono).
- **`src/lib/shop.ts`**: `resolveActiveShop` refatorado — retorna null em vez de lançar erro, não auto-cria loja; nova `createShop()` exportada.
- **`src/providers/AuthProvider.tsx`**: Adicionado `error`, `setupShop()`, `clearError()`; try/catch no `loadShop`.
- **`src/components/ShopSetup.tsx`**: Nova tela de onboarding para criar barbearia.
- **`src/components/AppLayout.tsx`**: Guardas para loading/shop null antes de renderizar app.

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

### STEP 1: Item 4 ✅ CONCLUÍDO — Formulários RHF + Zod
Todas as telas principais já usam RHF + Zod:
- `Services.tsx` ✅
- `Barbers.tsx` ✅
- `Clients.tsx` ✅
- `ShopSettings.tsx` ✅

### STEP 2: Item 5 — QA Operacional (PRÓXIMO)
Antes de avançar para Phase 3, validar em produção:
1. Criar um agendamento no site público → confirmar que o cliente recebe WhatsApp com link de cancelamento via `cancel_token`.
2. Confirmar que o barbeiro recebe notificação no WhatsApp.
3. Clicar no link de cancelamento → confirmar que cancela corretamente.
4. Aguardar o cron de re-engajamento (13h UTC) ou simular manualmente via Supabase.

### STEP 3: Phase 3 — Novas Features (só após Item 5 validado)
Executar nesta ordem:
1. **[FEAT-4] Multi-serviço no Admin**: Atualizar `Appointments.tsx` e `Booking.tsx` para suportar múltiplos serviços por agendamento (duração cumulativa, soma de preços, slots por duração total, salvar referências).
2. **[FEAT-5] `price_at_booking`**: Rastrear histórico de preços nos relatórios.
3. **[FEAT-6] Reagendamento em `ManageBooking`**: Permitir reagendamento autônomo pelo cliente.

---

## Hard Rules & Conventions

1. **No direct shadcn/ui edits**: Não modificar arquivos em `src/components/ui/` diretamente — exceto `form.tsx` que é implementação própria.
2. **Form Standards**: Sempre usar React Hook Form + Zod. Nunca `useState` isolado para campos de formulário.
3. **Timezone**: Todas as datas/horas devem ser manipuladas em UTC-3 (`America/Sao_Paulo` / offset `-03:00`).
4. **Build verification**: Sempre rodar `npm run build` após qualquer mudança. Zero erros TypeScript obrigatório.
5. **Types**: TypeScript estrito. Evitar `any` — exceto onde documentado (ex: `form.tsx` `rules` e `control`).
6. **Git push**: NUNCA executar `git push` como background task. Sempre fornecer o comando para o usuário rodar manualmente.

---

## Relationship to other files
- `ROADMAP.md`: Checklist vivo com tarefas granulares. Manter atualizado com `[x]`.
- `AGENTS.md` (no `user_rules`): Histórico técnico de sessões e contexto acumulado.
