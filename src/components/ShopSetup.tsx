import { useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Scissors, Loader2, Store, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function ShopSetup() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed.length < 2) {
      setError('O nome deve ter pelo menos 2 caracteres')
      return
    }
    setError('')
    setBusy(true)
    try {
      const { error: insertError } = await supabase
        .from('shops')
        .insert({ owner_user_id: user!.id, name: trimmed })
        .select('*')
        .single()

      if (insertError) {
        setError(`Erro ao criar: ${insertError.message}`)
        return
      }

      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar barbearia')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />
      <Card className="relative w-full max-w-md border-indigo-500/20 bg-white/95 shadow-2xl shadow-indigo-500/10 backdrop-blur dark:bg-gray-950/95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
            <Scissors className="size-8 text-white" />
          </div>
          <CardTitle className="bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-2xl font-black tracking-tight text-transparent dark:from-indigo-300 dark:to-blue-300">
            AppBarber
          </CardTitle>
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground/60">Sistema de Gestão</p>
          <CardDescription className="mt-2">
            Crie sua barbearia para começar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="shop-name" className="text-sm font-medium">
                Nome da Barbearia
              </label>
              <Input
                id="shop-name"
                placeholder="Ex: Studio Lima"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="border-indigo-500/20 focus:ring-indigo-500"
                disabled={busy}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500"
            >
              {busy ? (
                <><Loader2 className="mr-2 size-4 animate-spin" /> Criando...</>
              ) : (
                <><Store className="mr-2 size-4" /> Criar Barbearia</>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { signOut(); navigate('/login') }}>
              <LogOut className="mr-2 size-3" /> Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ShopSetup
