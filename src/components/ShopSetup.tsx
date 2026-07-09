import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Scissors, LogOut, AlertTriangle, Store } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function ShopSetup() {
  const { error: authError, clearError, signOut } = useAuth()
  const navigate = useNavigate()

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
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {authError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="mx-auto mb-2 size-6" />
              <p className="font-medium">Erro ao carregar dados</p>
              <p className="mt-1 text-xs opacity-80">{authError}</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={clearError}>
                  Tentar novamente
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { signOut(); navigate('/login') }}>
                  Sair
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-6">
                <Store className="mx-auto mb-3 size-10 text-indigo-500" />
                <CardDescription className="text-base">
                  Sua barbearia ainda não foi configurada.
                </CardDescription>
                <p className="mt-2 text-sm text-muted-foreground">
                  Entre em contato com o administrador para criar sua conta.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => { signOut(); navigate('/login') }}
              >
                <LogOut className="mr-2 size-4" /> Sair
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ShopSetup
