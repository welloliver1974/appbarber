// Supabase Edge Function: notify-barber-push
// Deno runtime (support npm: specifier)

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import webpush from 'npm:web-push@3.6.7'

// Supabase client with service_role (for internal function)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceRoleKey)

// VAPID keys – set via secret env variables
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails('mailto:admin@appbarber.app', vapidPublicKey, vapidPrivateKey)

export default async (req: Request) => {
  try {
    const payload = await req.json()
    const newRow = payload?.record?.new ?? payload?.new ?? null
    if (!newRow) return new Response('OK', { status: 200 })

    // Send notification for any insertion (as requested)
    const { barber_id, client_name, service_name, start_time, id } = newRow
    if (!barber_id) return new Response('OK', { status: 200 })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('barber_id', barber_id)
    if (!subs || subs.length === 0) return new Response('OK', { status: 200 })

    const notification = {
      title: 'Novo agendamento',
      body: `${client_name ?? 'Cliente'} marcou ${service_name ?? 'serviço'} às ${new Date(start_time).toLocaleTimeString('pt-BR')}`,
      url: `${Deno.env.get('NEXT_PUBLIC_BASE_URL') ?? ''}/appointments/${id}`,
    }

    const pushPayload = JSON.stringify(notification)
    await Promise.all(
      (subs as any[]).map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload
        )
      )
    )
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('notify-barber-push error:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
