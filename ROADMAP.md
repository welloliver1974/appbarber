# AppBarber — Roadmap

> Instrução: Siga a ordem abaixo. Conclua cada item, valide com `npm run build`, marque `[x]`, adicione a data.

---

## Stack

- **Frontend:** Vite + React 19 + TypeScript + TailwindCSS v4 + shadcn/ui
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Edge Functions, pg_cron)
- **WhatsApp:** Evolution API (self-hosted)
- **Deploy:** Vercel + Supabase (`chtjqqtvvlamrdesaiwp`)
- **Timezone:** UTC-3 (Brasília)

---

## ✅ Concluído (2026-07-10)

- **Fase 0:** Migrations + Edge Functions + Storage bucket — tudo aplicado
- **Fase 1:** 8 bugs críticos — RLS, timezone, empty arrays, buffer, etc.
- **Fase 2:** Notificar barbeiro, ShopSettings, reengage configurável
- **FEAT-4:** Multi-serviço no painel admin (`Appointments.tsx` + `Booking.tsx`)
- **FEAT-5:** `price_at_booking` + Faturamento na Dashboard
- **FEAT-6:** Reagendamento no `ManageBooking`
- **Sessão 18:** Upload de logo + auto-save hero/galeria
- **Sessão 19:** Fechado nos horários, badge Premium, Waze, telefone fix
- **Sessão 21:** Notificações push (Web Push) apenas para barbeiros — PWA, Service Worker, Edge Function `notify-barber-push`, migrações `push_subscriptions` e `notifications_enabled`, deploy completo, VAPID configurado (2026‑07‑11)

---

## 📋 Pendências (ordenadas por prioridade)

### 1. 🟢 Site Público — Depoimentos Dinâmicos

| Arquivo | O que fazer |
|---|---|
| `src/pages/PublicSite.tsx` | Substituir `TESTIMONIALS` fixo por dados do banco. Criar tabela `testimonials` (shop_id, name, text, rating, date). Adicionar CRUD no admin. |

### 2. 🟢 Site Público — Portfólio de Fotos por Barbeiro

| Arquivo | O que fazer |
|---|---|
| `src/pages/PublicSite.tsx` | Na seção de barbeiros, mostrar `barber.photo_url` + mini galeria de fotos associadas ao barbeiro |
| `src/lib/public-site.ts` | Incluir `photo_url` na query de barbers |
| Tabela `barbers` | Já tem `photo_url` — só falta exibir |

### 3. 🟢 Site Público — Link WhatsApp Fallback

| Arquivo | O que fazer |
|---|---|
| `src/pages/PublicSite.tsx` | Se a Evolution API estiver fora, exibir botão "Agendar via WhatsApp" com link `wa.me` |

### 4. 🟢 Admin — Duplicar Horários da Semana

| Arquivo | O que fazer |
|---|---|
| `src/pages/Barbers.tsx` | Botão "Copiar horários" que duplica os horários de um dia para os outros dias da semana |

### 5. 🟢 Admin — Dashboard Global

| Arquivo | O que fazer |
|---|---|
| `src/pages/AdminPage.tsx` | Adicionar métricas consolidadas de todas as lojas (total agendamentos, faturamento, clientes ativos) |

### 6. 🟢 Técnico — Lazy Loading

| Arquivo | O que fazer |
|---|---|
| `src/App.tsx` | Envolver páginas com `React.lazy()` + `Suspense` para reduzir chunk inicial (938KB) |

### 7. 🟡 Qualidade de Vida

| Item | O que fazer |
|---|---|
| Busca clientes por telefone | Adicionar input de busca por `phone` em `Clients.tsx` |
| Atalhos de teclado | `N` = novo agendamento, `S` = salvar, etc. |
| Paginação | Em listas longas (clientes, agendamentos) |

### 8. 🟡 Admin — Exportar Relatórios

| Item | O que fazer |
|---|---|
| CSV / PDF | Adicionar botão de exportação em `Reports.tsx` |

### 9. ✅ Admin — Notificações Browser (concluída em 2026‑07‑11)

> Implementado como PWA com Web Push (Service Worker). Notificações são enviadas apenas para barbeiros que ativam a opção na página de “Barbeiros” → “Ativar notificações de navegador”. Detalhes no CLAUDE.md e no README.

### 10. 🔵 Site Público — Calendário .ics

| Item | O que fazer |
|---|---|
| Página de confirmação | Adicionar botão "Adicionar ao calendário" gerando arquivo .ics |

---

## 📊 Referência Técnica

```
Tabelas:
  shops              → id, owner_user_id, public_slug, name, phone, address, logo_url,
                       instagram, working_hours, gallery_photos, hero_photo
  barbers            → shop_id, name, phone, photo_url, bio, active
  barber_availability → barber_id, day_of_week, start_time, end_time
  services           → shop_id, name, description, duration_minutes, price, active, buffer_minutes
  clients            → shop_id, name, phone, email, notes
  appointments       → shop_id, barber_id, client_id, service_id, start_time, end_time,
                       status, cancel_token, notes, price_at_booking
  appointment_services → appointment_id, service_id
  whatsapp_configs   → shop_id, server_url, instance_name, api_key, active, reengage_interval_days

Edge Functions:
  notify-appointment → webhook (INSERT/UPDATE) — msg ao cliente + barbeiro + cancel_token
  reminder           → pg_cron 15min — lembra agendamentos em ~1h
  reengage           → pg_cron 13h UTC — re-engaja inativos (intervalo configurável)

Rotas:
  Públicas:  /public/:slug, /public/:slug/manage
  Admin:     /, /barbers, /services, /clients, /appointments, /reports, /whatsapp, /settings
```

## 🔗 Arquivos-Chave

| Arquivo | Função |
|---|---|
| `src/App.tsx` | Rotas |
| `src/components/AppLayout.tsx` | Sidebar + guardas |
| `src/lib/availability.ts` | Algoritmo de slots |
| `src/lib/evolution.ts` | WhatsApp API |
| `src/lib/timezone.ts` | UTC-3 |
| `src/lib/storage.ts` | Upload de fotos |
| `src/providers/AuthProvider.tsx` | Auth + shop ativo |
