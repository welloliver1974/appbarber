# Roadmap – Notificações push para barbeiros (sem admin)

## Objetivo
- Quando um cliente agenda um horário, o **barbeiro** recebe imediatamente uma notificação push no navegador (desktop, Android PWA e iOS Safari PWA).
- A notificação contém título, resumo (cliente – serviço – horário) e, ao ser clicada, abre a página do agendamento no SaaS.
- **Limite:** 1 notificação por agendamento (nenhuma duplicação).
- Exibir um **badge** na UI (próximo ao ícone da agenda) indicando a quantidade de notificações não visualizadas.

## Escopo da notificação
- **Barbeiro** (ou dono da loja) recebe push.
- **Admin** **não** recebe push (continua usando apenas WhatsApp e dashboard).

## Arquitetura resumida
| Camada | Função | Tecnologias |
|-------|--------|-------------|
| Banco (Supabase) | Guardar a subscription de cada barbeiro | Nova tabela `barber_push_subscriptions` (barber_id FK, endpoint, p256dh, auth, created_at). |
| Front‑end | Solicitar permissão, registrar Service Worker, gerar subscription (VAPID), enviar ao Supabase; UI para ativar/desativar; badge de contagem. | Hook `usePushNotifications`, página **Configurações da Loja**, React Context (`NotificationContext`). |
| Service Worker (`public/sw.js`) | - `push` → `showNotification` (title, body, URL).<br>- `notificationclick` → abre URL (`/appointments/:id`).<br>- `postMessage({type:'new-push'})` para atualizar o badge. | JavaScript puro. |
| Edge Function `push‑appointment` | Recebe `{appointment_id}`, busca o agendamento, busca a(s) subscription(s) do barbeiro, monta payload (`title`, `body`, `url`), envia push usando **web‑push** + VAPID private key. | Node/TS, lib `web-push`, VAPID keys via env vars. |
| Integração ao fluxo existente | Após a chamada que já envia WhatsApp (`notify‑appointment`), disparar `push‑appointment` com o `appointment.id`. | Mesmo ponto de chamada que já existe. |
| Badge UI | Service Worker envia `postMessage`; React Context escuta e incrementa contador; badge exibido ao lado do ícone da agenda; ao abrir a página de agenda o contador zera. | React state / Context, `navigator.serviceWorker.addEventListener('message', …)`. |
| iOS (Safari PWA) | Instruir o usuário a **Adicionar à Home Screen** para que o Service Worker funcione. | Texto de ajuda na UI + link para instruções. |

## Passos de implementação (sprints)

| Sprint | Tarefas | Resultado esperado |
|-------|---------|--------------------|
| **S1 – VAPID & Migration** | 1️⃣ Gerar VAPID keys (`npx web-push generate-vapid-keys`).<br>2️⃣ Salvar a public key como `VITE_VAPID_PUBLIC_KEY` (front) e a private como `VAPID_PRIVATE_KEY` (env var da Edge Function).<br>3️⃣ Criar migration SQL para a tabela `barber_push_subscriptions`. | Chaves prontas; tabela criada no Supabase. |
| **S2 – Service Worker** | Criar `public/sw.js` com handlers `push`, `notificationclick` e envio de `postMessage` para badge. | SW pronto para registrar. |
| **S3 – Hook & UI** | Implementar hook `usePushNotifications(barberId)` que: <br> - solicita permissão (`Notification.requestPermission`);<br> - registra SW (`navigator.serviceWorker.register('/sw.js')`);<br> - cria subscription (`pushManager.subscribe({userVisibleOnly:true, applicationServerKey: VAPID_PUBLIC_KEY})`);<br> - grava/substitui a subscription no Supabase (`upsert`).<br>Adicionar botão “Ativar notificações” na página **Configurações da Loja**. | Barbeiro pode ativar/desativar push; subscription salva. |
| **S4 – Edge Function `push‑appointment`** | 1️⃣ Receber `appointment_id`.<br>2️⃣ Buscar agendamento + `barber_id`.<br>3️⃣ Buscar todas as subscriptions do `barber_id`.<br>4️⃣ Montar payload (`title='Novo agendamento'`, `body='Cliente – Serviço – Horário'`, `url='/appointments/<id>'`).<br>5️⃣ Enviar push via `web-push.sendNotification`.<br>6️⃣ (Opcional) gravar `push_sent_at` em `appointments`. | Push enviado ao barbeiro (e apenas ao barbeiro). |
| **S5 – Integração ao fluxo existente** | Dentro da Edge Function `notify‑appointment` (que já envia WhatsApp), após o `await` que envia o WhatsApp, chamar `push‑appointment` via `fetch` (mesmo endpoint, usando Service‑Role key). | Cada novo agendamento dispara **WhatsApp + push** – exatamente uma notificação por agendamento. |
| **S6 – Badge UI** | 1️⃣ Criar `NotificationContext` (React context) contendo `{count, increment, reset}`.<br>2️⃣ No SW, após `showNotification`, chamar `self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage({type:'new-push'})))`.
3️⃣ No provider, escutar `navigator.serviceWorker.addEventListener('message', …)` e chamar `increment()`.
4️⃣ Exibir `count` como badge ao lado do ícone da agenda (ou no header).
5️⃣ Quando o usuário abre a página de agenda, chamar `reset()` para zerar o contador. | Usuário vê número de notificações não lidas; ao abrir a agenda o número volta a zero. |
| **S7 – Testes & QA** | - Chrome/Edge desktop (permissão concedida).<br>- Chrome Android (PWA).<br>- iOS Safari: instruir “Adicionar à Home Screen”.<br>- Negação de permissão (apenas WhatsApp continua).<br>- Múltiplos dispositivos (desktop + mobile) recebem a mesma notificação.<br>- Verificar que **não** há push para admin (consulta `barber_id`). | Todos os cenários funcionam, sem duplicação de notificações. |
| **S8 – Documentação** | Atualizar `README.md` / `MANUAL_USO.md` com: <br> • Como gerar VAPID keys.<br> • Como ativar notificações nas Configurações.<br> • Observação iOS (Add to Home Screen).<br> • Comportamento de fallback (WhatsApp). | Usuários sabem como habilitar e o que esperar. |
| **S9 – Deploy** | Commit & push das mudanças (migration, SW, hook, edge function, UI, badge).<br>Deploy automático no Vercel (front) e Supabase (functions). | Sistema em produção com push funcionando. |

## Decisão sobre o admin
- **Não** criaremos subscription para o admin. <br>- O botão “Ativar notificações” aparece **apenas** na página de Configurações da loja (acessível ao dono da barbearia e aos barbeiros). <br>- Caso futuramente deseje que o admin receba push, bastaria inserir um registro com `barber_id = null`, mas isso não será feito agora. 

## Próximas ações
1. **Aprovar** este plano (ou sugerir ajustes). 
2. Quando estiver pronto, iniciaremos a fase de implementação (S1 → S9). 

---
*Este documento foi gerado a pedido do usuário para registrar o roadmap de notificações push.*