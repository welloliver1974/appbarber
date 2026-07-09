import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: reengage
 *
 * Objetivo: Disparar mensagem de re-engajamento para clientes que:
 *   1. Tiveram seu último atendimento COMPLETADO há mais de INACTIVE_DAYS dias
 *   2. NÃO possuem nenhum agendamento futuro pendente ou confirmado
 *
 * Acionamento: pg_cron a cada 24h (configurado via migration SQL)
 *
 * Ajuste INACTIVE_DAYS conforme o perfil de frequência da barbearia.
 */

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()

    // ── Buscar clientes que ficaram inativos ──────────────────────────────────
    // 1. Para cada shop com WhatsApp configurado, varrer os clients

    const { data: configs, error: cfgErr } = await supabase
      .from('whatsapp_configs')
      .select('shop_id, server_url, instance_name, api_key, reengage_interval_days')
      .eq('active', true)

    if (cfgErr || !configs || configs.length === 0) {
      console.warn('[reengage] No active WhatsApp configs found')
      return new Response('No active configs', { status: 200 })
    }

    let totalSent = 0
    let totalSkipped = 0

    for (const config of configs as {
      shop_id: string
      server_url: string
      instance_name: string
      api_key: string
      reengage_interval_days: number | null
    }[]) {
      // ── Buscar a loja para montar o link público ──
      const { data: shop } = await supabase
        .from('shops')
        .select('name, public_slug')
        .eq('id', config.shop_id)
        .maybeSingle()

      const shopName = (shop as { name: string; public_slug: string | null } | null)?.name ?? 'a barbearia'
      const shopSlug = (shop as { name: string; public_slug: string | null } | null)?.public_slug
      const bookingLink = shopSlug
        ? `${Deno.env.get('PUBLIC_SITE_URL') ?? supabaseUrl.replace('.supabase.co', '.vercel.app')}/public/${shopSlug}`
        : null

      // ── Buscar todos os clientes desta loja ──────────────────────────────
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, phone')
        .eq('shop_id', config.shop_id)

      const clientList = (clients ?? []) as { id: string; name: string; phone: string }[]
      if (clientList.length === 0) continue

      const clientIds = clientList.map((c) => c.id)

      // ── Último atendimento COMPLETADO por cliente ─────────────────────────
      const { data: lastCompleted } = await supabase
        .from('appointments')
        .select('client_id, end_time')
        .eq('shop_id', config.shop_id)
        .eq('status', 'completed')
        .in('client_id', clientIds)
        .order('end_time', { ascending: false })

      // Construir mapa: client_id → último end_time concluído
      const lastCompletedMap = new Map<string, Date>()
      for (const apt of (lastCompleted ?? []) as { client_id: string; end_time: string }[]) {
        if (!lastCompletedMap.has(apt.client_id)) {
          lastCompletedMap.set(apt.client_id, new Date(apt.end_time))
        }
      }

      // ── Agendamentos FUTUROS (pendente ou confirmado) por cliente ─────────
      const { data: futureApts } = await supabase
        .from('appointments')
        .select('client_id')
        .eq('shop_id', config.shop_id)
        .in('status', ['pending', 'confirmed'])
        .gt('start_time', now.toISOString())
        .in('client_id', clientIds)

      const hasFutureApt = new Set(
        ((futureApts ?? []) as { client_id: string }[]).map((a) => a.client_id)
      )

      // ── Filtrar candidatos ao re-engajamento ─────────────────────────────
      const intervalDays = config.reengage_interval_days ?? 22
      const cutoff = new Date(now.getTime() - intervalDays * 24 * 60 * 60 * 1000)

      const targets = clientList.filter((client) => {
        const lastDate = lastCompletedMap.get(client.id)
        if (!lastDate) return false          // Nunca teve atendimento concluído
        if (hasFutureApt.has(client.id)) return false  // Já tem horário futuro
        return lastDate < cutoff             // Último atendimento passou do prazo
      })

      if (targets.length === 0) {
        console.log(`[reengage] shop=${config.shop_id}: no inactive clients`)
        totalSkipped += clientList.length
        continue
      }

      console.log(`[reengage] shop=${config.shop_id}: ${targets.length} inactive clients to message`)

      // ── Disparar mensagens ────────────────────────────────────────────────
      const results = await Promise.allSettled(
        targets.map(async (client) => {
          const lastDate = lastCompletedMap.get(client.id)!
          const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

          const msg = [
            `💈 *${shopName}*`,
            ``,
            `Olá ${client.name}! Tudo bem?`,
            ``,
            `Já faz *${daysSince} dias* desde sua última visita.`,
            `Que tal garantir seu horário antes que a agenda lote? 🔥`,
            ``,
            bookingLink
              ? `👉 Agende em 1 minuto: ${bookingLink}`
              : `Entre em contato para agendar seu horário.`,
            ``,
            `Te esperamos! 🪒✂️`,
          ].join('\n')

          const res = await fetch(
            `${config.server_url.replace(/\/$/, '')}/message/sendText/${config.instance_name}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: config.api_key,
              },
              body: JSON.stringify({
                number: client.phone.replace(/\D/g, ''),
                text: msg,
                delay: 1200,
              }),
            },
          )

          if (!res.ok) {
            const err = await res.text()
            console.error(`[reengage] Failed to send to ${client.name} (${client.phone}):`, err)
            throw new Error(`HTTP ${res.status}`)
          }

          console.log(`[reengage] ✅ Sent to ${client.name} (${daysSince}d inactive)`)
        }),
      )

      const sent = results.filter((r) => r.status === 'fulfilled').length
      totalSent += sent
      totalSkipped += targets.length - sent
    }

    const summary = `Sent=${totalSent} Skipped=${totalSkipped}`
    console.log(`[reengage] Done. ${summary}`)
    return new Response(summary, { status: 200 })
  } catch (err) {
    console.error('[reengage] Fatal error:', err)
    return new Response(err instanceof Error ? err.message : 'Internal error', { status: 500 })
  }
})
