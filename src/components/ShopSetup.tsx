import { useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Scissors, Loader2, Store } from 'lucide-react'

function ShopSetup() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { setupShop, error: authError, clearError } = useAuth()

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
      await setupShop(trimmed)
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
          <CardDescription className="mt-4">
            Você ainda não tem uma barbearia cadastrada.<br />
            Crie uma agora para começar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Erro ao carregar dados</p>
              <p className="mt-1 text-xs opacity-80">{authError}</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-xs text-destructive hover:bg-destructive/10" onClick={clearError}>
                Tentar novamente
              </Button>
            </div>
          )}
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
        </CardContent>
      </Card>
    </div>
  )
}

export default ShopSetup
