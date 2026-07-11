import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useNotification } from '@/contexts/NotificationContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function useBarberPush(barberIdProp?: string) {
  const { user } = useAuth()
  const barberId = barberIdProp ?? user?.id
  const { requestPermission, subscribe, unsubscribe } = useNotification()
  const [enabled, setEnabled] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  // Load current flag from DB when we have barberId
  useEffect(() => {
    if (!barberId) return
    const fetchFlag = async () => {
      const { data, error } = await supabase
        .from('barbers')
        .select('notifications_enabled')
        .eq('id', barberId)
        .single()
      if (error) {
        console.error('Failed to load notification flag', error)
        return
      }
      setEnabled(data?.notifications_enabled ?? false)
    }
    fetchFlag()
  }, [barberId])

  const toggle = async (value: boolean) => {
    if (!barberId) return
    setLoading(true)
    try {
      if (value) {
        // Enable: request permission and subscribe
        const result = await requestPermission()
        if (result === 'granted') {
          await subscribe(barberId)
        }
      } else {
        await unsubscribe(barberId)
      }
      // Persist flag in barbers table
      const { error } = await supabase
        .from('barbers')
        .update({ notifications_enabled: value })
        .eq('id', barberId)
      if (error) throw error
      setEnabled(value)
      toast.success(`Notificações ${value ? 'ativadas' : 'desativadas'}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao atualizar notificações: ' + msg)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return { enabled, toggle, loading }
}
