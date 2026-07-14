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
- **Sessão 25/26:** Download .ics na confirmação do booking + ajuste layout confirmação
- **Sessão 27:** ErrorBoundary global
- **Sessão 28:** Realtime no Dashboard + busca clientes por telefone
- **Sessão 30:** Tradução labels de filtro (i18n)
- **Depoimentos dinâmicos:** Substituído `TESTIMONIALS` fixo por dados da tabela `testimonials`
- **Portfólio barbeiros:** `photo_url` já exibido no site público
- **WhatsApp fallback:** Link `wa.me` já exibido quando não há phone/whatsapp config
- **Upload logo ShopSettings:** Implementado com `uploadLogoPhoto`
- **Migration `is_combo`:** Aplicada no Cloud — coluna ativa e funcional (verificado em 2026-07-14)

---

## 📋 Pendências (ordenadas por prioridade)

### 1. 🟢 Admin — Duplicar Horários da Semana

| Arquivo | O que fazer |
|---|---|
| `src/pages/Barbers.tsx` | Botão "Copiar horários" que duplica os horários de um dia para os outros dias da semana |

### 2. 🟢 Admin — Dashboard Global

| Arquivo | O que fazer |
|---|---|
| `src/pages/AdminPage.tsx` | Adicionar métricas consolidadas de todas as lojas (total agendamentos, faturamento, clientes ativos) |

### 3. 🟢 Admin — Exportar Relatórios CSV/PDF

| Item | O que fazer |
|---|---|
| `src/pages/Reports.tsx` | Adicionar botão de exportação |

### 4. 🟢 Infra — SETUP.md + Changelog

| Item | O que fazer |
|---|---|
| `SETUP.md` | Documentar setup local: bucket gallery, VAPID keys, migrations, edge functions |
| `CHANGELOG.md` | Criar changelog resumido com versões (v1.0, v1.1...) |

### 5. 🟡 Qualidade de Vida

| Item | O que fazer |
|---|---|
| Atalhos de teclado | `N` = novo agendamento, `S` = salvar, etc. |
| Paginação | Em listas longas (clientes, agendamentos) |
| Confirmação ao sair | De formulários com dados não salvos |

### 6. 🟡 Técnico — TanStack React Query

| Item | O que fazer |
|---|---|
| Cache e refetch automático | Substituir `useEffect` + `useState` por queries gerenciadas |

### 7. 🔵 Testes Automatizados

| Item | O que fazer |
|---|---|
| Unitários (vitest) | Testar criação de serviço com `is_combo`, RLS multi-tenant |
| Push notification flow | Subscribe → trigger → receive |
| Playwright (E2E) | Fluxos críticos (booking, login admin, cancelamento) |

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
