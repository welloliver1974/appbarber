import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type WhatsAppConnectionState = 'connected' | 'disconnected' | 'unknown' | 'loading'

interface WhatsAppStatusResult {
  state: WhatsAppConnectionState
  /** Recarrega o status manualmente */
  refresh: () => void
}

/**
 * Hook que verifica o status de conexão da instância Evolution API
 * configurada para a barbearia ativa.
 *
 * Retorna:
 * - `connected`    → instância online e com WhatsApp vinculado
 * - `disconnected` → instância existe mas está offline / sem QR Code
 * - `unknown`      → sem configuração salva no banco
 * - `loading`      → aguardando resposta
 *
 * Revalida automaticamente a cada 60 segundos.
 */
export function useWhatsAppStatus(shopId: string | undefined): WhatsAppStatusResult {
  const [state, setState] = useState<WhatsAppConnectionState>('loading')

  async function check() {
    if (!shopId) {
      setState('unknown')
      return
    }

    try {
      const { data: config } = await supabase
        .from('whatsapp_configs')
        .select('server_url, instance_name, api_key')
        .eq('shop_id', shopId)
        .eq('active', true)
        .maybeSingle()

      if (!config) {
        setState('unknown')
        return
      }

      const c = config as { server_url: string; instance_name: string; api_key: string }
      const url = `${c.server_url.replace(/\/$/, '')}/instance/connectionState/${c.instance_name}`

      const res = await fetch(url, {
        headers: { apikey: c.api_key },
      })

      if (!res.ok) {
        setState('disconnected')
        return
      }

      const json = await res.json() as { instance?: { state?: string }; state?: string }

      // A Evolution API pode retornar o estado em caminhos diferentes dependendo da versão
      const rawState = json?.instance?.state ?? json?.state ?? ''

      if (rawState === 'open') {
        setState('connected')
      } else {
        setState('disconnected')
      }
    } catch {
      setState('disconnected')
    }
  }

  useEffect(() => {
    check()
    // Revalida a cada 60 segundos
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [shopId])

  return { state, refresh: check }
}
