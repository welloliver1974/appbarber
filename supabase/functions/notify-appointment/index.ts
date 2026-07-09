import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE'
  table: string
  record: {
    id: string
    shop_id: string
    barber_id: string
    client_id: string
    service_id: string
    start_time: string
    status: string
    cancel_token: string | null
  }
  old_record?: {
    status?: string
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload: WebhookPayload = await req.json()
    const { record, old_record, type } = payload

    // Em UPDATEs, só processa se o status mudou de fato (evitar spam)
    if (type === 'UPDATE' && old_record?.status === record.status) {
      return new Response('Status unchanged — skipped', { status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const [clientRes, barberRes, serviceRes, shopRes] = await Promise.all([
      supabase.from('clients').select('name, phone').eq('id', record.client_id).single(),
      supabase.from('barbers').select('name, phone').eq('id', record.barber_id).single(),
      supabase.from('services').select('name').eq('id', record.service_id).single(),
      supabase.from('shops').select('name, public_slug').eq('id', record.shop_id).single(),
    ])

    const client = clientRes.data as { name: string; phone: string } | null
    const barber = barberRes.data as { name: string; phone: string | null } | null
    const service = serviceRes.data as { name: string } | null
    const shop = shopRes.data as { name: string; public_slug: string | null } | null

    if (!client) {
      return new Response('Client not found', { status: 404 })
    }

    const date = new Date(record.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const time = new Date(record.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
    const shopName = shop?.name ?? 'Barbearia'
    const shopSlug = shop?.public_slug ?? null
    
    const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://appbarber.vercel.app'
    const bookingUrl = shopSlug
      ? `${publicSiteUrl.replace(/\/$/, '')}/public/${shopSlug}`
      : null

    // ── Mensagens distintas por status ──
    let msg: string

    if (type === 'INSERT' || record.status === 'pending') {
      // Novo agendamento criado — aguardando confirmação do barbeiro
      const cancelLine = bookingUrl
        ? `\n\nPrecisa cancelar? Acesse: ${bookingUrl}/manage?token=${record.cancel_token}`
        : ''
      msg = [
        `🪒 *${shopName}*`,
        ``,
        `Olá *${client.name}*, recebemos seu pedido de agendamento!`,
        ``,
        `📅 *${date}* às *${time}*`,
        `💈 ${service?.name ?? 'Serviço'}`,
        `✂️ ${barber?.name ?? 'Barbeiro'}`,
        ``,
        `⏳ Seu horário será confirmado em breve. Fique de olho!${cancelLine}`,
      ].join('\n')

    } else if (record.status === 'confirmed') {
      // Barbeiro confirmou o agendamento no painel SaaS
      const cancelLine = bookingUrl
        ? `\n\nPrecisa cancelar? Acesse: ${bookingUrl}/manage?token=${record.cancel_token}`
        : ''
      msg = [
        `🪒 *${shopName}*`,
        ``,
        `✅ Olá *${client.name}*, seu agendamento foi *CONFIRMADO*!`,
        ``,
        `📅 *${date}* às *${time}*`,
        `💈 ${service?.name ?? 'Serviço'}`,
        `✂️ ${barber?.name ?? 'Barbeiro'}`,
        ``,
        `Te esperamos lá! 💪${cancelLine}`,
      ].join('\n')

    } else if (record.status === 'cancelled') {
      // Agendamento cancelado
      const reschedule = bookingUrl
        ? `Quer remarcar? Acesse: ${bookingUrl}`
        : `Entre em contato para remarcar.`
      msg = [
        `🪒 *${shopName}*`,
        ``,
        `❌ Olá *${client.name}*, seu agendamento do dia *${date}* às *${time}* foi *cancelado*.`,
        ``,
        reschedule,
      ].join('\n')

    } else {
      // completed ou qualquer outro status — sem notificação
      return new Response(`Status "${record.status}" — no message sent`, { status: 200 })
    }

    const { data: config } = await supabase
      .from('whatsapp_configs')
      .select('server_url, instance_name, api_key')
      .eq('active', true)
      .maybeSingle()

    if (!config) {
      console.warn('[notify-appointment] WhatsApp config not found')
      return new Response('WhatsApp not configured', { status: 200 })
    }

    const c = config as { server_url: string; instance_name: string; api_key: string }

    const response = await fetch(
      `${c.server_url.replace(/\/$/, '')}/message/sendText/${c.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: c.api_key,
        },
        body: JSON.stringify({
          number: client.phone.replace(/\D/g, ''),
          text: msg,
          delay: 1000,
        }),
      },
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[notify-appointment] Evolution API error sending to client:', err)
      return new Response(err, { status: 500 })
    }

    // Se for novo agendamento, notifica o barbeiro (se houver telefone cadastrado)
    if (type === 'INSERT' && barber?.phone) {
      const barberMsg = [
        `📅 *Novo agendamento!*`,
        ``,
        `O cliente *${client.name}* agendou *${service?.name ?? 'Serviço'}* para dia *${date}* às *${time}*.`,
        ``,
        `Acesse o painel para confirmar.`,
      ].join('\n')

      const barberResponse = await fetch(
        `${c.server_url.replace(/\/$/, '')}/message/sendText/${c.instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: c.api_key,
          },
          body: JSON.stringify({
            number: barber.phone.replace(/\D/g, ''),
            text: barberMsg,
            delay: 1200,
          }),
        },
      )

      if (!barberResponse.ok) {
        const err = await barberResponse.text()
        console.error('[notify-appointment] Evolution API error sending to barber:', err)
      } else {
        console.log(`[notify-appointment] Barber notification sent to ${barber.name}`)
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[notify-appointment] Error:', err)
    return new Response(err instanceof Error ? err.message : 'Internal error', { status: 500 })
  }
})
