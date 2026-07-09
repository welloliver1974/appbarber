# Plano de Melhorias Futuras: Conexão Pública & SaaS Operacional

> 🚨 **INSTRUÇÃO CRÍTICA PARA QUALQUER AGENTE DE IA**:
> 1. Você **DEVE** seguir a sequência de implementação ordenada abaixo exatamente nesta ordem. Não avance para a próxima etapa sem concluir a anterior.
> 2. Ao final de cada implementação bem-sucedida, você **DEVE** atualizar este arquivo (`FUTURE_IMPROVEMENTS.md`), alterando a caixinha da etapa concluída de `[ ]` para `[x]`, para manter o histórico de progresso transparente.
> 3. Verifique o build (`npm run build`) após cada etapa para garantir a integridade do código.
>
> ✅ **Todas as 6 etapas deste arquivo foram concluídas.**
> 📋 **O próximo plano de trabalho está em [`ROADMAP.md`](./ROADMAP.md)** — leia-o primeiro.

---

## 📅 Sequência Cronológica de Execução (Roteiro de Alta Eficiência)

- [x] **Etapa 1: Links de Marketing por Barbeiro (Barber Slugs)** ✅ _concluído em 2026-07-09_
- [x] **Etapa 2: Confirmação de WhatsApp via SaaS (Status `confirmed`)** ✅ _concluído em 2026-07-09_ — deploy manual pendente (`supabase functions deploy notify-appointment`)
- [x] **Etapa 3: Monitor de Status da Evolution API no Dashboard do SaaS** ✅ _concluído em 2026-07-09_
- [x] **Etapa 4: Cancelamento Autônomo pelo Cliente (Auto-Serviço)** ✅ _concluído em 2026-07-09_
- [x] **Etapa 5: Agendamentos de Múltiplos Serviços & Tempo de Limpeza (Buffer)** ✅ _concluído em 2026-07-09_
- [x] **Etapa 6: Retenção Ativa: Motor de Re-engajamento Automático** ✅ _concluído em 2026-07-09_

---

## 🛠️ Detalhamento das Etapas

### Etapa 1: Links de Marketing por Barbeiro (Barber Slugs)
*   **Objetivo**: Permitir que cada barbeiro divulgue seu próprio link de agendamento (ex: Instagram Stories).
*   **Friction**: Mínima (não requer banco de dados ou APIs adicionais).
*   **Especificação**:
    *   A página pública deve ler o parâmetro de busca na URL, como `/public/studio-lima?barber=nome-do-barbeiro` ou `/public/studio-lima?barber=ID`.
    *   Ao carregar o Booking Wizard, se o parâmetro estiver presente, auto-selecionar o barbeiro correspondente e avançar o usuário diretamente para a Etapa 1 (Serviços).

### Etapa 2: Confirmação de WhatsApp via SaaS (Status `confirmed`)
*   **Objetivo**: Notificar o cliente no celular assim que o barbeiro confirmar o horário no painel de controle.
*   **Friction**: Baixa (infraestrutura de WhatsApp já configurada).
*   **Especificação**:
    *   Atualizar a Edge Function do Supabase que gerencia notificações (`notify-appointment`) para disparar uma nova mensagem de WhatsApp via Evolution API quando o status do agendamento transicionar para `confirmed`.
    *   Mensagem sugerida: *"Olá [Nome], seu agendamento para [Data] às [Hora] com [Barbeiro] foi CONFIRMADO com sucesso! Te esperamos lá."*

### Etapa 3: Monitor de Status da Evolution API no Dashboard do SaaS
*   **Objetivo**: Dar visibilidade para a barbearia sobre a saúde dos disparos de mensagens automáticas.
*   **Friction**: Média.
*   **Especificação**:
    *   No cabeçalho ou sidebar do SaaS administrativo, adicionar um pequeno indicador visual em tempo real conectado com a Evolution API.
    *   🟢 **WhatsApp Ativo** / 🔴 **WhatsApp Desconectado** (exibindo aviso ou atalho para re-escriturar o QR Code se estiver offline).

### Etapa 4: Cancelamento Autônomo pelo Cliente (Auto-Serviço)
*   **Objetivo**: Permitir que o cliente cancele ou remarque seu próprio horário sem precisar iniciar uma conversa longa no WhatsApp.
*   **Friction**: Média/Alta.
*   **Especificação**:
    *   Criar uma página pública de gerenciamento de reserva (ex: `/public/studio-lima/manage?token=ID_DO_AGENDAMENTO`).
    *   Nessa tela simplificada, o cliente pode clicar em "Cancelar". O sistema altera o status no Supabase para `cancelled` e notifica o barbeiro.
    *   Adicionar esse link no rodapé de todas as mensagens de confirmação enviadas na Etapa 2.
    *   Respeitar o limite de antecedência configurado (ex: bloquear cancelamento se faltar menos de 2 horas para o atendimento).

### Etapa 5: Agendamentos de Múltiplos Serviços & Tempo de Limpeza (Buffer)
*   **Objetivo**: Permitir a reserva de pacotes ou mais de um corte simultâneo (ex: Cabelo + Barba).
*   **Friction**: Alta (exige alteração pesada no algoritmo de horários livres).
*   **Especificação**:
    *   Permitir seleção de múltiplos serviços no Wizard.
    *   Ajustar a lógica do utilitário `availability.ts` para somar a duração de todos os serviços selecionados e buscar no banco de dados por blocos de horários livres contíguos correspondentes à soma.
    *   Implementar o bloqueio automático de um tempo de limpeza (buffer de 5 a 15 min) configurável no painel administrativo após cada corte.

### Etapa 6: Retenção Ativa: Motor de Re-engajamento Automático
*   **Objetivo**: Garantir que o cliente retorne de forma passiva através de lembretes inteligentes.
*   **Friction**: Alta.
*   **Especificação**:
    *   Criar uma Edge Function acionada a cada 24 horas via `pg_cron`.
    *   O script faz a varredura no Supabase por clientes cujo último corte completado ocorreu há mais de 20-25 dias e que não possuem nenhum agendamento futuro.
    *   Dispara mensagem no WhatsApp: *"Olá [Nome]! Tudo bem? Já faz [X] dias desde a sua última visita ao Studio Lima. Que tal garantir seu horário para esta semana antes que a agenda lote? Agende agora em 1 minuto: [Link Público]"*.
