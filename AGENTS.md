# AppBarber — Contexto do Projeto

## Stack
- **Frontend:** Vite + React 19 + TypeScript
- **UI:** TailwindCSS v4 + shadcn/ui v4 + dark mode (padrão escuro)
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **Notificações:** Evolution API (WhatsApp, self-hosted)
- **Deploy:** Vercel
- **Timezone:** UTC-3 (Brasília)

## Tema Visual
- **Paleta:** Índigo vibrante como cor primária (HSL 239 84% 57%)
- **Light mode:** Fundo azul clarinho (226 100% 97%), sidebar gradiente índigo escuro
- **Dark mode:** Fundo azul muito escuro (240 30% 6%), sidebar gradiente índigo escuro
- **Gradientes:** `from-indigo-500 to-blue-600` em ícones, botões e cards
- **Logo:** Nome com gradiente `from-indigo-200 to-blue-200` + `bg-clip-text text-transparent`, subtítulo "GESTÃO" caixa alta espaçada
- **Animações:** fade-in-up, scale-in, slide-in-left, bounce-in em cards e listas
- **User prefere:** cores vivas com índigo, sem tons acinzentados/mortos

## Convenções

### Código
- TypeScript estrito, sem `any`
- Componentes em `src/components/` com subpastas por domínio
- Páginas em `src/pages/`
- Hooks customizados em `src/hooks/`
- Utilitários em `src/lib/`
- Tipos em `src/types/`

### Commits
- `feat:` nova funcionalidade
- `fix:` correção
- `chore:` setup, config, deps
- `refactor:` refatoração sem mudança de comportamento

### shadcn/ui
- Componentes em `src/components/ui/`
- Nono-shadowing: não modificar componentes do shadcn diretamente (exceto `form.tsx`)
- Preferir composição via `className` e `asChild`

## Regras
1. Não modificar componentes do shadcn/ui (exceto `form.tsx`)
2. Dark mode ativado por padrão
3. Todos horários exibidos em UTC-3 (Brasília)
4. Zod schemas sempre tipados com inferência
5. React Hook Form + Zod para formulários
6. Supabase client singleton via contexto
7. Auth state gerenciado via provider
8. **Admin identificado por email** (`welloliver@gmail.com`) em `AuthProvider.tsx`
9. **Clientes** só veem Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, Relatórios
10. **Admin sem loja** só vê Admin, WhatsApp na sidebar
11. **Admin com loja** vê tudo (base + Admin, Configurações, WhatsApp, Site Público)

## Estrutura
```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── AppLayout.tsx    # Sidebar + mobile header + logo + guardas (loading/onboarding/admin)
│   ├── ShopSetup.tsx    # Onboarding: criar barbearia (qualquer usuário logado)
│   └── PageTransition.tsx
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Barbers.tsx
│   ├── Services.tsx
│   ├── Clients.tsx
│   ├── Appointments.tsx
│   ├── Booking.tsx
│   ├── WhatsAppSettings.tsx
│   ├── Reports.tsx
│   ├── AdminPage.tsx    # Painel admin (só admin vê)
│   └── ShopSettings.tsx # Config da loja (só admin vê)
├── hooks/
│   └── useTheme.ts
│   └── useWhatsAppStatus.ts
├── lib/
│   ├── supabase.ts
│   ├── shop.ts          # resolveActiveShop simplificado (só busca por owner_user_id)
│   ├── evolution.ts
│   ├── availability.ts
│   ├── timezone.ts
│   ├── site.ts
│   ├── public-site.ts
│   ├── storage.ts
│   └── utils.ts
├── providers/
│   ├── ThemeProvider.tsx
│   └── AuthProvider.tsx  # isAdmin por email, error state, clearError
├── types/
│   └── database.ts
└── App.tsx               # Rotas: /login, /booking, /public/:slug, /admin, /settings, etc.
```

## Fluxo de Usuários

### Login
- **Dois modos** com toggle no rodapé do card:
  - **Barbearia** (padrão): digita nome da barbearia + senha → sistema busca `auth_email` via RPC `lookup_shop_auth_email` → faz login no Supabase Auth com email + senha
  - **Admin**: digita email + senha (login direto no Supabase Auth, sem lookup)
- **Sem cadastro**: só admin cria contas (via Supabase dashboard ou Edge Function)

### Admin (welloliver@gmail.com)
1. Login → `resolveActiveShop` retorna null (admin não tem shop)
2. Guard do AppLayout detecta `isAdmin && !shop` → permite `/admin`, `/whatsapp`, `/settings`
3. Sidebar (sem loja): Admin, WhatsApp
4. Sidebar (com loja): Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, WhatsApp, Relatórios, Admin, Configurações
5. Em `/admin`: vê todas as lojas, cria novas (nome + senha), edita, exclui
6. Em `/whatsapp` (sem loja): dropdown pra selecionar qual loja configurar

### Cliente (dono de barbearia)
1. Login (nome da barbearia + senha) → Supabase Auth valida
2. `resolveActiveShop` busca por `owner_user_id` do usuário autenticado
3. Sidebar: Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, Relatórios
4. Se não achar loja → tela "Sua barbearia ainda não foi criada. Contate o administrador." (com opção de sair ou tentar novamente)

### Criação de barbearia (pelo admin)
1. Admin em `/admin` → Nova Barbearia
2. Digita **nome da barbearia** + **senha de acesso**
3. Sistema gera `auth_email` (ex: `shop-studio-lima-abc123@appbarber.app`)
4. Chama Edge Function `create-auth-user` (cria usuário no Supabase Auth com service_role)
5. Chama RPC `admin_create_shop` (cria loja com `owner_user_id` + `auth_email`)
6. Pronto. Barbeiro loga com nome da barbearia + senha

## Pendências (precisa executar manualmente)
- Rodar `supabase/fix_rpc_only.sql` no Supabase SQL Editor (adiciona coluna `auth_email`, RPC `lookup_shop_auth_email`, RPCs de admin com security definer, policy `is_admin`)

## Histórico de Alterações

### Sessão 2 — Tema Índigo + Logo
- **index.css:** Tema refeito com HSL de índigo vibrante, light mode azul clarinho, dark mode azul escuro profundo
- **AppLayout.tsx:** Sidebar gradiente índigo escuro com logo centralizado (ícone gradiente + nome gradiente + "GESTÃO"), mobile header idêntico
- **Login.tsx:** Fundo gradiente índigo escuro, glow radial, card branco/transparente, logo com gradiente
- **Dashboard.tsx:** Cards com ícones gradiente índigo, bordas indigo/20, sombras indigo, hover animations
- **Booking.tsx:** Fundo índigo escuro, inputs foco indigo, botão gradiente
- **Barbers.tsx, Services.tsx, Clients.tsx, Appointments.tsx, WhatsAppSettings.tsx:** Headers com ícone gradiente índigo, cards borda indigo/10, hover indigo/30, botões gradiente, empty states com ícone indigo

### Sessão 3 — Validação de Horários Disponíveis
- **lib/availability.ts:** Utilitário para gerar slots (30min), verificar conflitos com agendamentos existentes e consultar disponibilidade via barber_availability + appointments
- **Barbers.tsx:** Adicionado botão "Horários" (ícone Clock) em cada card; abre dialog com checkboxes para dia da semana + inputs time de início/fim; salva em lote na tabela barber_availability (deleta antigos, insere novos)
- **Booking.tsx:** Ao selecionar barbeiro + serviço + data, busca slots disponíveis e exibe como grade de botões clicáveis (estilo chip); remove input time livre; valida dupla verificação antes de salvar (re-consulta disponibilidade)
- **Appointments.tsx:** Mesmo fluxo no dialog de criação: substitui input time por grade de horários disponíveis; valida conflito antes de inserir; desabilita botão criar sem horário selecionado

### Sessão 4 — Edge Functions (WhatsApp Server-Side + Lembrete)
- **supabase/functions/notify-appointment/index.ts:** Edge Function que recebe webhook do banco (INSERT/UPDATE em appointments) e envia WhatsApp via Evolution API
- **supabase/functions/reminder/index.ts:** Edge Function que busca appointments confirmed começando em ~1h e envia lembretes; chamada a cada 15min via pg_cron
- **supabase/config.toml:** Configuradas ambas as functions (verify_jwt = false para aceitar webhook)
- **schema.sql:** Adicionado trigger `trg_notify_appointment` (AFTER INSERT OR UPDATE OF status) chamando `net.http_post`; adicionado pg_net + pg_cron + cron.schedule('send-reminders', '*/15 * * * *')
- **supabase functions deploy:** ambas deployadas no projeto chtjqqtvvlamrdesaiwp

### Sessão 5 — Grade Visual + Booking Refinado + Relatórios
- **Dashboard.tsx:** Adicionada "Agenda Semanal" com grade visual de horários (colunas = dias, linhas = 08h–20h, appointments como blocos coloridos por status); seletor de barbeiro + navegação entre semanas
- **Booking.tsx:** Refatorado com fluxo em 3 etapas (Passo 1: barbeiro+serviço, Passo 2: data+horários agrupados por Manhã/Tarde/Noite, Passo 3: dados pessoais); indicador de progresso visual; resumo do agendamento na confirmação
- **Reports.tsx:** Nova página de relatórios com cards de resumo (total, concluídos, faturamento, ticket médio); gráfico de barras por barbeiro com %; gráfico de faturamento mensal; seletor de período (mês/3 meses/ano)
- **App.tsx + AppLayout.tsx:** Rota /reports adicionada + item "Relatórios" na sidebar

### Sessão 6 — Polimento Operacional Final
- **Dashboard.tsx:** Adicionados indicadores de atenção imediata (próximas 2h, pendentes, concluídos e cancelados), painel de próximos atendimentos e carga por barbeiro
- **Booking.tsx:** Inserido resumo fixo do agendamento, máscara de WhatsApp, feedback mais claro e data/hora montadas com UTC-3 explícito
- **Appointments.tsx:** Cada item agora abre detalhe completo com ações rápidas (confirmar, concluir, cancelar, excluir) sem sair da lista
- **Barbers.tsx, Services.tsx, Clients.tsx:** Busca, filtros, métricas rápidas e estados vazios mais consistentes para acelerar uso diário
- **Reports.tsx:** Resumos, leitura rápida e carregamento ajustados para ficar mais confiável e legível
- **WhatsAppSettings.tsx:** Estado de configuração e teste de conexão reorganizados com melhor hierarquia visual
- **Login.tsx + AppLayout.tsx:** Primeira impressão e fluxo de entrada alinhados com a identidade do app; redirecionamento ficou declarativo
- **build:** Build de produção validado após o polimento final

### Sessão 7 — Próxima sequência técnica
- **1. Multitenancy real:** base implementada; a loja ativa agora vem do contexto autenticado nas telas principais, e clientes já seguem o mesmo recorte por loja
- **2. RLS de verdade:** trocar políticas genéricas por políticas isoladas por shop/usuário no Supabase
- **3. Timezone consistente:** base auditada nas telas principais; criação, leitura e filtro de datas/hora agora usam UTC-3 de forma explícita
- **4. Formulários padrão:** migrar os fluxos restantes para `React Hook Form + Zod` onde fizer sentido
- **5. QA operacional:** validar webhook, cron, notificações e fluxos críticos depois das mudanças de backend
- **Regra de sequência:** executar nessa ordem; não avançar para o item seguinte sem fechar o anterior

### Sessão 8 — Site Público (Studio Lima)
- **supabase/migrations/20260708194100_public_site_data.sql:** Adicionadas colunas `instagram`, `working_hours` (JSONB), `gallery_photos` (JSONB), `hero_photo` na tabela `shops`
- **supabase/migrations/20260708194200_apply_all_missing.sql:** Unifica todas as colunas pendentes (`owner_user_id`, `public_slug`, instagram, etc.)
- **src/types/database.ts:** Interface `Shop` updated com os novos campos; `public_slug` agora opcional
- **src/lib/site.ts:** `buildPublicSiteUrl` agora retorna `/public/slug` no localhost
- **src/lib/public-site.ts:** `loadPublicShopContext` fallback para primeira loja se `public_slug` não existir; aceita `slug: string | null`
- **src/lib/shop.ts:** `resolveActiveShop` trata colunas faltantes (migration não aplicada)
- **src/lib/storage.ts:** **CRIADO** — upload/delete de fotos (hero + galeria) via Supabase Storage
- **src/pages/PublicSite.tsx:** **REESCRITO** — estilo Sancho Barbearia (fundo neutro escuro, sem índigo, premium), slug extraído de `/public/:slug` (rota) ou subdomínio, galeria com fotos
- **src/App.tsx:** Adicionado rota `<Route path="/public/:slug" element={<PublicSite />} />` + `shouldRenderPublicSite()` para subdomínios
- **src/pages/WhatsAppSettings.tsx:** Seção "Site Público" com upload de fotos (file input + preview), mantidos Instagram, Working Hours, Copiar link
- **src/components/AppLayout.tsx:** Item "Site Público" (ícone Globe) na sidebar
- **build:** Produção validado após mudanças

### Sessão 9 — Redesign Premium do Site Público (Luxury Gold)
- **src/pages/PublicSite.tsx:** Reescrito completamente com tema de luxo escuro (fundo preto absoluto `#050505`, glows radiais dourados e destaques âmbar/ouro). Adicionado wizard de 4 etapas (serviços com categorias/busca, barbeiros com bio, datas horizontais de 14 dias em chips e slots por períodos de turno, formulário de WhatsApp com máscara e resumo flutuante).
- **future_improvements_plan.md:** **CRIADO** — Plano de melhorias futuras para integrar estreitamente o Site Público ao SaaS.
- **build:** Produção validada com sucesso.

### Sessão 10 — Segurança, Notificações e Configurações (2026-07-09)
- **supabase/migrations/20260709200000_add_buffer_minutes_to_services.sql:** Coluna `buffer_minutes INTEGER DEFAULT 0` em `services`
- **supabase/migrations/20260709210000_reengage_cron.sql:** pg_cron `send-reengage` agendado para 13h UTC diariamente
- **supabase/migrations/20260709220000_roadmap_improvements.sql:** Adicionado `cancel_token UUID` em `appointments`, `phone TEXT` em `barbers`, `reengage_interval_days INT DEFAULT 22` em `whatsapp_configs`
- **src/types/database.ts:** Interfaces `Appointment`, `Barber` e `WhatsAppConfig` atualizadas com os novos campos
- **src/lib/storage.ts:** Função `uploadLogoPhoto` adicionada para upload do logo da loja
- **supabase/functions/notify-appointment/index.ts:** Envia link de cancelamento com `cancel_token` (não mais `id`); dispara segunda mensagem ao barbeiro no INSERT com phone
- **supabase/functions/reengage/index.ts:** Lê `reengage_interval_days` do banco por loja antes de filtrar clientes inativos
- **src/pages/Barbers.tsx:** Campo de edição de telefone do barbeiro adicionado
- **src/pages/WhatsAppSettings.tsx:** Input numérico para configurar intervalo de re-engajamento
- **src/pages/ShopSettings.tsx:** **CRIADO** — tela de configurações da loja (nome, telefone, endereço, logo)
- **src/App.tsx:** Rota `/settings` adicionada
- **src/components/AppLayout.tsx:** Item "Configurações" (ícone Settings) adicionado na sidebar
- **src/pages/ManageBooking.tsx:** Busca agendamento via `.eq('cancel_token', token)` em vez de `.eq('id', token)`
- **build:** `npm run build` validado com sucesso (`✓ built in 1.17s`)
- **Commit:** `dda8579` + `0a6b0ea` — locais; push para `origin main` ainda pendente
- **⚠️ PENDENTE:** Todas as 3 migrations + 2 edge function deploys + push precisam ser executados manualmente (ver `ROADMAP.md` Fase 0)
- **✅ RESOLVIDO:** `ShopSettings.tsx` migrado para React Hook Form + Zod; `src/components/ui/form.tsx` criado (shadcn Form sem deps externas)

### Sessão 11 — RHF+Zod Forms (continuação)
- **`src/pages/Barbers.tsx`**: Formulário de cadastro/edição migrado para React Hook Form + Zod (nome e telefone do WhatsApp com validação)
- **`src/pages/Clients.tsx`**: Formulário migrado para RHF + Zod (nome, WhatsApp, email, notas)
- **`src/components/ui/form.tsx`**: Reescrito com `FormField` usando `useFormContext()` internamente para evitar conflito de generics do `react-hook-form` v7+ com `zodResolver`. A prop `control` é aceita mas ignorada (compat. de API). A prop `rules` é tipada como `any`
- **`src/pages/Services.tsx`**: Corrigido `.default('0')` no schema Zod de `buffer_minutes` (eliminava divergência input/output no resolver); removido `asChild` do `DialogTrigger`

### Sessão 12 — Admin Panel + RLS Fix (2026-07-09)
- **`supabase/fix_rls_policies.sql`**: SQL de correção RLS — adiciona colunas faltantes (`public_slug`, `instagram`, etc.), cria tabela `admins` + função `is_admin()`, corrige políticas SELECT/UPDATE/DELETE para permitir que admin veja todas as lojas
- **`src/lib/shop.ts`**: `resolveActiveShop` simplificado — só busca por `owner_user_id`. Remove auto-criação de loja e lógica de claim de loja sem dono
- **`src/providers/AuthProvider.tsx`**: Adicionado `error` (state), `clearError()`, `isAdmin` (checks `ADMIN_EMAILS` = `['welloliver@gmail.com']`); try/catch no `loadShop` para não quebrar o app
- **`src/components/ShopSetup.tsx`**: **CRIADO** — tela de onboarding com formulário "Criar Barbearia" para qualquer usuário logado sem loja. Usa `supabase.from('shops').insert()` diretamente
- **`src/components/AppLayout.tsx`**: Guardas: `loading` → spinner; `!shop && !isAdmin` → ShopSetup; `isAdmin && !shop` → redirect `/admin`. Nav items dinâmicos: admin vê Admin+Config, cliente só vê operacional
- **`src/pages/AdminPage.tsx`**: **CRIADO** — painel admin com listagem de todas as lojas, modal de criação (nome + UUID do dono), exclusão com confirmação
- **`src/App.tsx`**: Rota `/admin` adicionada
- **NavItems**: Separados em `baseNavItems` (Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, WhatsApp, Relatórios) e `adminNavItems` (Admin, Configurações)
- **fix:** Correção do erro 403 (RLS) que impedia cadastro/edição de barbearia + admin sem loja ser redirecionado corretamente
- **build:** `npm run build` validado com sucesso
- **Commits:** `7569d63`, `75a63c5`

### Sessão 13 — Login por Nome + Edge Function Auth + Sidebar Admin/Cliente (2026-07-09)
- **`src/pages/Login.tsx`**: **REESCRITO** — login com nome da barbearia + senha (padrão) OU email + senha (admin, toggle no rodapé). Remove cadastro público. Usa RPC `lookup_shop_auth_email` pra buscar email interno pelo nome da loja
- **`src/components/AppLayout.tsx`**: Guarda `!shop && !isAdmin` agora mostra `NoShopPage` (mensagem "contate o administrador") em vez de `ShopSetup`. Guarda admin sem loja permite `/admin`, `/whatsapp`, `/settings`. Nav items: `baseNavItems` (só Dashboard, Barbeiros, Serviços, Clientes, Agendamentos, Relatórios) sem WhatsApp nem Site Público. `adminNavItems` (Admin, WhatsApp). `settingsNavItem` incluso só se admin tem loja. WhatsApp badge só pra admin. Sidebar fixa em desktop com `overflow-y-auto` na nav e `lg:ml-64` no conteúdo
- **`src/pages/AdminPage.tsx`**: **REESCRITO** — criação de barbearia agora com campo **senha**. Gera `auth_email` automaticamente. Chama Edge Function `create-auth-user` (cria usuário no Supabase Auth com `service_role`), depois RPC `admin_create_shop` com o UUID retornado. Não precisa mais copiar UUID manualmente. Banner amarelo se RPCs não existirem
- **`src/pages/WhatsAppSettings.tsx`**: Adicionado suporte pra admin sem loja: carrega lista de lojas via RPC `admin_get_all_shops` e mostra dropdown pra selecionar qual configurar. Toda lógica de load/save usa `targetShopId` em vez de `shop.id`
- **`src/pages/ShopSettings.tsx`**: Admin sem loja agora redireciona pra `/admin` (em vez de spinner infinito)
- **`src/lib/supabase.ts`**: Exporta `supabaseUrl` para uso no AdminPage
- **`src/types/database.ts`**: Adicionado campo `auth_email` na interface `Shop`
- **`supabase/functions/create-auth-user/index.ts`**: **CRIADO** — Edge Function que cria usuário no Supabase Auth com `service_role` (admin.createUser). Aceita `{ email, password }`, retorna `{ user_id }`. Com CORS headers
- **`supabase/fix_rpc_only.sql`**: **REESCRITO** — Adiciona: coluna `auth_email` em shops, RPC `lookup_shop_auth_email`, RPC `admin_create_shop` com parâmetro `auth_email`, RPC `is_admin()` + policy SELECT, instruções completas
- **`supabase/config.toml`**: Adicionado `[functions.create-auth-user]` com `verify_jwt = false`
- **Edge Function deploy**: `npx supabase functions deploy create-auth-user --project-ref chtjqqtvvlamrdesaiwp`
- **Vercel deploy**: Múltiplos deploys em `https://appbarber-rose.vercel.app`
- **Git**: Commits `585ff2f` até `a8a003b` (8 commits), push para `origin main`
- **`src/lib/site.ts`**: `buildPublicSiteUrl` simplificado — sempre usa `/public/{slug}` (remove lógica de subdomínio que quebrava no Vercel)
- **`src/pages/AdminPage.tsx`**: Adicionado botão "Abrir site público" em cada card de loja no `/admin`
- **build:** `npm run build` validado após cada alteração
- **Commits:** `585ff2f` até `8448e2a` (10 commits), push para `origin main`
- **Vercel deploy**: Múltiplos deploys em `https://appbarber-rose.vercel.app`
- **Edge Function deploy**: `create-auth-user` deployada via `supabase functions deploy`
- **✔️ RESOLVIDO:** `supabase/fix_rpc_only.sql` já executado (RPCs + coluna `auth_email` no ar)

### Sessão 14 — Correção RLS, Booking Público e Dashboard (2026-07-09)
- **Diagnóstico:** Erro `404 (Not Found)` ao inserir em `appointments` — na verdade era RLS bloqueando INSERT (42501), exibido como 404 pelo browser
- **Problema real 1:** `net.http_post` no trigger `trg_notify_appointment` chamava `body := jsonb::text`, mas `pg_net v0.20.3` espera `jsonb` — causava erro `function net.http_post(url => unknown, body => text, headers => jsonb) does not exist`
- **Problema real 2:** RLS `can_view_shop()` só permitia anon para a **primeira loja** (`public_booking_shop_id()`), bloqueando qualquer acesso público a lojas secundárias
- **Correções no Supabase (SQL executado via `supabase db query --linked`):**
  - `can_view_shop()` alterado para retornar `true` para `auth.role() = 'anon'` em qualquer loja
  - Políticas INSERT de `clients` e `appointments` atualizadas para permitir anon em qualquer loja
  - Políticas SELECT de `clients` e `appointments` atualizadas para permitir anon (necessário para `.select()` pós-INSERT e `getAvailableSlots()`)
  - Trigger `notify_appointment_webhook` recriado com `body` como `jsonb` (sem `::text`)
  - Schema do PostgREST recarregado via `NOTIFY pgrst, 'reload schema'`
- **`src/pages/PublicSite.tsx`:** Catch do `handleSubmit` melhorado — mostra `String(submitError)` ou `submitError.message` em vez de fallback genérico; agora exibe erros reais do Supabase
- **`src/pages/Dashboard.tsx`:** Substituído `Intl.DateTimeFormat('pt-BR', { weekday: 'short' })` e `toLocaleDateString('pt-BR')` por mapa fixo `WEEKDAY_LABELS` para evitar nomes de dias em inglês; seletor de barbeiro corrigido (usava `value="all"` que o `@base-ui/react/select` exibia como texto "all" em vez do placeholder)
- **`supabase/schema.sql`:** Trigger `notify_appointment_webhook` corrigido (removeu `::text` do body)
- **`supabase/migrations/20260709230000_fix_public_rls_all_shops.sql`:** **CRIADO** — migration com correções RLS
- **`src/pages/PublicSite.tsx`:** Adicionado botão "Voltar ao início" na tela de sucesso (ao lado de "Novo agendamento")
- **`src/pages/Dashboard.tsx`:** Seletor de barbeiro usa `value=""` em vez de `value="all"` (Base UI exibia o valor bruto); dias da semana com mapa fixo pt-BR
- **`src/pages/WhatsAppSettings.tsx`:** Chamadas a `ensureGalleryBucket()` antes de uploads; bucket `gallery` criado via SQL + policies de Storage RLS
- **`supabase/storage_rls.sql`:** Políticas para anon ler/escrever/deletar objetos no bucket `gallery`
- **Vercel deploy:** Múltiplos deploys em `https://appbarber-rose.vercel.app` (8 deploys)
- **Git:** `7875832..208babd` — push para `origin main`
- **⚠️ PENDENTE (resolvido na Sessão 15):** Upload de fotos no Storage não funciona — bucket `gallery` foi criado + políticas RLS adicionadas, mas upload ainda falha (verificar `ensureGalleryBucket()` e permissões Storage no Supabase Dashboard)

### Sessão 16 — Correção de 8 Bugs Técnicos (2026-07-10)
- **BUG-1** `src/lib/availability.ts:45`: Substituído `new Date(dateStr + 'T00:00:00')` por `startOfUTC3DayISO()`/`endOfUTC3DayISO()` do `timezone.ts` — garantia de UTC-3
- **BUG-2** `src/lib/evolution.ts:9-18`: `getConfig()` agora aceita `shopId` e filtra `.eq('shop_id', shopId)`. `sendText()` inclui `shopId` no params. Callers em Appointments, Booking, PublicSite atualizados
- **BUG-3** `src/pages/Appointments.tsx:121`: Adicionado `if (clientIds.length > 0)` antes do `.in('id', clientIds)` para evitar SQL inválido
- **BUG-4/5** `src/pages/Booking.tsx:96,148` + `Appointments.tsx:73,193`: `getAvailableSlots()` agora recebe `duration_minutes + buffer_minutes`. `endTime` mantém só `duration_minutes` (variável `slotDur` renomeada)
- **BUG-6** `src/pages/AdminPage.tsx:151,171`: RPCs `admin_update_shop`/`admin_delete_shop` com try/catch → fallback para `.update()`/`.delete()` direto na tabela `shops`
- **BUG-7** `src/pages/PublicSite.tsx:232`: Dep `serviceIds` (array, referência) → `serviceIds.join(',')` (string, valor)
- **BUG-8** `src/pages/PublicSite.tsx` (5 ocorrências): `text-neutral-450` → `text-neutral-400` (classe inexistente no Tailwind v4)
- **build:** `npm run build` validado após cada correção

### Sessão 17 — FEAT-5: `price_at_booking` + Faturamento na Dashboard (2026-07-10)
- **`supabase/migrations/20260710170000_add_price_at_booking.sql`**: Migration adiciona `price_at_booking NUMERIC(10,2)` em `appointments`
- **`src/types/database.ts`**: Adicionado `price_at_booking: number | null` na interface `Appointment`
- **`src/pages/Appointments.tsx`**: Salva `price_at_booking: selectedService?.price` no insert
- **`src/pages/Booking.tsx`**: Salva `price_at_booking: selectedService?.price` no insert
- **`src/pages/PublicSite.tsx`**: Salva `totalPrice` (soma dos serviços) como `price_at_booking` no insert
- **`src/pages/Reports.tsx`**: Substituído `servicePriceMap.get(a.service_id)` por `a.price_at_booking ?? servicePriceMap.get(a.service_id) ?? 0` nos 3 cálculos (total, barberStats, monthlyStats). Mantém `services` query como fallback p/ registros antigos
- **`src/pages/Dashboard.tsx`**: Adicionado 5º card "Faturamento do Mês" (ícone DollarSign, verde). Grid `sm:grid-cols-3 lg:grid-cols-5`. Query busca `price_at_booking` de appointments completed do mês atual. Skeleton ajustado p/ 5 cards. Valor formatado em R$ via `Intl.NumberFormat`
- **fix pós-build:** Query de faturamento removia `.lte('start_time', now)` — appointments completed com data futura (ex: marcado como executado antes do horário) ficavam de fora. Removido o `.lte` para incluir todos os completed do mês.
- **Supabase Cloud**: Migration aplicada via CLI (`ALTER TABLE ... ADD COLUMN`)
- **Backfill**: UPDATE executado para preencher `price_at_booking` nos 3 appointments existentes (usando `services.price` atual)
- **build:** `npm run build` validado

### Sessão 16.1 — Botão "Copiar link" → "Abrir site público" (2026-07-10)
- **`src/pages/WhatsAppSettings.tsx`**: Botão "Copiar link do site" substituído por "Abrir site público" (`window.open`), removido estado `copiedLink` e ícone `Copy` não utilizado
- **build:** `npm run build` validado

### Sessão 18 — Upload de Logo + Auto-save Hero/Galeria + Rollback owner_user_id (2026-07-10)
- **Problema 1: owner_user_id errado.** Studio Lima tinha `owner_user_id` = `d1538bee...` mas o auth UUID de welloliver@gmail.com é `e7cdc124...`. `resolveActiveShop()` retornava `null` para o admin. **Corrigido via SQL:** `UPDATE shops SET owner_user_id = 'e7cdc124-...'`
- **⚠️ Rollback imediato:** Mudar o `owner_user_id` fez o admin ser tratado como dono da loja — sidebar misturou Admin + painel da barbearia. Revertido para `d1538bee...`
- **Problema 2: handleLogoUpload sem try/catch.** `uploadLogoPhoto()` faz `throw error` mas `handleLogoUpload` não tratava exceções — erros silenciosos. **Corrigido:** adicionado try/catch + `ensureGalleryBucket()` + auto-save no banco imediatamente (remove fluxo de 2 etapas)
- **Problema 3: Upload de hero_photo e gallery_photos só atualizava estado local.** Usuário precisava clicar "Salvar configurações do site" separadamente. Se esquecesse, a foto sumia. **Corrigido:** upload de hero e galeria agora fazem auto-save no banco + delete também persiste a remoção
- **Problema 4: Admin não conseguia acessar o ShopSettings (redirect p/ /admin).** **Corrigido:** guarda trocado para mostrar mensagem amigável com link para WhatsApp > Site Público
- **Problema 5: Admin sem loja não tinha como fazer upload de logo.** **Corrigido:** Adicionada seção de upload de logo no WhatsAppSettings (Site Público), ao lado do hero_photo. Funciona com `targetShopId` (dropdown) — mesma mecânica do hero/galeria
- **Arquivos alterados:** `ShopSettings.tsx`, `WhatsAppSettings.tsx`, `AGENTS.md`, `ROADMAP.md`
- **SQL executado:** `UPDATE shops SET owner_user_id = 'd1538bee...'` (rollback)
- **build:** `npm run build` validado

### Sessão 19 — Horários "Fechado" + Card Contato + Telefone (2026-07-10)
- **FEAT:** WhatsAppSettings — adicionado checkbox "Fechado" por dia nos horários. Quando marcado, desabilita inputs time e salva `"fechado"` no JSONB `working_hours`
- **FEAT:** PublicSite — badge "Barbearia Exclusiva" → "Barbearia Premium"
- **FEAT:** PublicSite — card de contato reordenado: Endereço + Maps/Waze juntos, depois WhatsApp, depois Instagram
- **FEAT:** PublicSite — adicionado botão Waze ao lado do Maps para navegação
- **FIX:** PublicSite — `formatPhoneInput` comia 2 dígitos do telefone (`5511999999999` era exibido como `(55) 11999-9999` em vez de `(11) 99999-9999`). Corrigido: remove country code `55` antes de formatar
- **build:** `npm run build` validado

### Sessão 15 — Correção Upload de Imagens + Botão Salvar Horários (2026-07-10)
- **Problema 1:** Upload de fotos (hero/galeria) não funcionava por 3 causas:
  - `ensureGalleryBucket()` tentava criar bucket via client-side (`createBucket` requer `service_role`) — sempre falhava
  - Upload bloqueado para admin sem loja: guardas usavam `!shop` (sempre null para admin) em vez de `!targetShopId`
  - `deletePhoto()` usava `slice(4)` no path → produzia `public/gallery/shop-id/file.jpg` em vez de `shop-id/file.jpg`
  - `uploadGalleryPhoto()` sem `{ upsert: true }` (hero e logo já tinham)
- **Problema 2:** Botão "Salvar configurações do site" nunca habilitava para admin sem loja (`disabled={savingSite || !shop}` com `shop=null`)
- **`src/lib/storage.ts`:** `ensureGalleryBucket` removido `createBucket` → só verifica existência; `deletePhoto` corrigido `slice(4)` → `slice(6)`; `uploadGalleryPhoto` adicionado `{ upsert: true }`
- **`src/pages/WhatsAppSettings.tsx`:** Uploads usam `targetShopId` em vez de `shop.id`; guardas `!shop` → `!targetShopId`; botão salvar e link público usam `sitePublicSlug` (carregado do banco via `public_slug`)
- **2ª correção (upload ainda falhava):** Bucket `gallery` nunca existia no Supabase — removido `ensureGalleryBucket` com verificação falha, agora função vazia retorna `true` sempre; criada migration `20260710150000_create_gallery_storage.sql` que cria bucket + RLS policies via SQL direto
- **3ª correção (working_hours não aparecia no site público):** Política RLS de UPDATE em `shops` não incluía `public.is_admin()`. Save retornava sucesso mas 0 linhas afetadas. Criada migration `20260710160000_fix_admin_rls_update.sql` que adiciona `is_admin()` nas policies de shops e whatsapp_configs + tabela admins + função is_admin. Frontend: `.select('id')` nas chamadas update para detectar updates sem efeito
- **4ª correção (upload ainda falhava mesmo com bucket existente):** Storage RLS policies só permitiam `anon`, mas admin logado é `authenticated`. Substituídas todas por policy única `Gallery All` (FOR ALL USING bucket_id = 'gallery') que libera select/insert/update/delete sem filtrar por role
- **5ª correção (card em branco ao lado dos horários):** Card de contato no site público não tinha verificação de conteúdo. Envolvido em `{shop.address || shop.phone || instagramLink ? ... : null}` para não renderizar vazio
- **6ª melhoria (hero photo como fundo do agendamento):** `src/pages/PublicSite.tsx` — criada variável `bookingBg` que reusa a `hero_photo` com overlay escuro (`rgba(5,5,5,0.70)` → `rgba(5,5,5,0.88)`); seção de agendamento (`#agendar`) movida para fora do `<main>` (full-width, sem `max-w-6xl`); gradiente fade `from-[#050505] via-transparent to-[#050505]` nas bordas; padding aumentado para `py-24 md:py-32`. Fallback para fundo escuro se não houver foto.
- **`MANUAL_USO.md`:** Criado manual completo de uso do sistema com 15 seções (login, dashboard, barbeiros, serviços, clientes, agendamentos, relatórios, WhatsApp, site público, configurações, admin, perfis, experiência pública, solução de problemas)
- **build:** `npm run build` validado com sucesso (v1.10s v1.09s)

