import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Shop } from '@/types/database'
import { resolveActiveShop } from '@/lib/shop'

const ADMIN_EMAILS = ['welloliver@gmail.com']

interface AuthContextType {
  user: User | null
  shop: Shop | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshShop: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user ? ADMIN_EMAILS.includes(user.email ?? '') : false

  async function loadShop(sessionUser: User | null) {
    try {
      setError(null)
      if (!sessionUser) {
        setShop(null)
        return
      }
      const sessionIsAdmin = sessionUser?.email ? ADMIN_EMAILS.includes(sessionUser.email) : false
      const currentShop = await resolveActiveShop(sessionUser, sessionIsAdmin)
      setShop(currentShop)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar barbearia'
      console.error('[AuthProvider] loadShop error:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      loadShop(nextUser)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      setLoading(true)
      loadShop(nextUser)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function refreshShop() {
    await loadShop(user)
  }

  function clearError() {
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ user, shop, loading, error, isAdmin, signIn, signUp, signOut, refreshShop, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
