import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import PageTransition from '@/components/PageTransition'
import { ShieldCheck, Store, Plus, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ShopRow {
  id: string
  name: string
  owner_user_id: string | null
  public_slug: string | null
  created_at: string
}

function AdminPage() {
  const [shops, setShops] = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function loadShops() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_get_all_shops')

    if (error) {
      toast.error('Erro ao carregar lojas: ' + error.message)
      setShops([])
    } else if (data) {
      setShops(data as ShopRow[])
    }
    setLoading(false)
  }

  useEffect(() => { loadShops() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed.length < 2) return

    setSaving(true)
    const { error } = await supabase.rpc('admin_create_shop', {
      shop_name: trimmed,
      owner_id: ownerId.trim() || null,
    })

    if (error) {
      toast.error('Erro ao criar: ' + error.message)
    } else {
      toast.success('Barbearia criada!')
      setName('')
      setOwnerId('')
      setOpen(false)
      loadShops()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta barbearia? Todos os dados associados serão perdidos.')) return
    const { error } = await supabase.rpc('admin_delete_shop', { shop_id: id })
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
    } else {
      toast.success('Barbearia excluída')
      loadShops()
    }
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin</h1>
              <p className="text-sm text-muted-foreground">Gerenciar barbearias do SaaS</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                <Plus className="mr-2 size-4" /> Nova Barbearia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Barbearia</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Barbearia</label>
                  <Input
                    placeholder="Ex: Studio Lima"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    ID do Usuário (opcional)
                  </label>
                  <Input
                    placeholder="Cole o UUID do usuário no Supabase Auth"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Crie o usuário em Supabase &gt; Authentication &gt; Users, copie o UUID e cole aqui.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
                >
                  {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Criando...</> : <><Store className="mr-2 size-4" /> Criar</>}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-indigo-500" />
          </div>
        ) : shops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Store className="mb-3 size-12 opacity-30" />
            <p>Nenhuma barbearia cadastrada</p>
            <p className="mt-1 text-xs">Clique em "Nova Barbearia" para criar a primeira.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shops.map((shop) => (
              <Card key={shop.id} className="border-indigo-500/10">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{shop.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive/60 hover:text-destructive"
                      onClick={() => handleDelete(shop.id)}
                    >
                      &times;
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                    <span className="text-muted-foreground">ID</span>
                    <button
                      className="flex items-center gap-1 font-mono text-xs text-indigo-500 hover:text-indigo-400"
                      onClick={() => copyId(shop.id)}
                    >
                      {shop.id.slice(0, 8)}&hellip;
                      {copiedId === shop.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                    <span className="text-muted-foreground">Dono</span>
                    <span className="font-mono text-xs">
                      {shop.owner_user_id ? `${shop.owner_user_id.slice(0, 8)}…` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                    <span className="text-muted-foreground">Slug</span>
                    <span className="text-xs">{shop.public_slug ?? '—'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default AdminPage
