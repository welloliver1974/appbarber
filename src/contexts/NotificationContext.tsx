import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface NotificationContextProps {
  permission: NotificationPermission
  requestPermission: () => Promise<NotificationPermission>
  subscribe: (barberId: string) => Promise<void>
  unsubscribe: (barberId: string) => Promise<void>
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (typeof Notification === 'undefined') return 'default'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }

  const subscribe = async (barberId: string) => {
    if (permission !== 'granted') return
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.ready
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
    const endpoint = subscription.endpoint
    const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!)))
    const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
    await supabase.from('push_subscriptions').upsert({
      barber_id: barberId,
      endpoint,
      p256dh,
      auth,
    })
  }

  const unsubscribe = async (barberId: string) => {
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('barber_id', barberId)
    }
  }

  // Helper to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  return (
    <NotificationContext.Provider value={{ permission, requestPermission, subscribe, unsubscribe }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider')
  return ctx
}
