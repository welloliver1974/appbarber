import { useEffect, useState } from 'react'
import { supabase, supabaseUrl } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import PageTransition from '@/components/PageTransition'
import { ShieldCheck, Store, Plus, Loader2, Copy, Check, Settings, Save, Trash2, Terminal, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface ShopRow {
  id: string
  name: string
  owner_user_id: string | null
  auth_email: string | null
  public_slug: string | null
  phone: string | null
  address: string | null
  logo_url: string | null
  instagram: string | null
  created_at: string
}

const EDGE_FUNCTION_URL = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/create-auth-user`

function AdminPage() {
  const [shops, setShops] = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<ShopRow | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Edit form fields
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editInstagram, setEditInstagram] = useState('')

  function generateAuthEmail(shopName: string): string {
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const rand = Math.random().toString(36).slice(2, 8)
    return `shop-${slug}-${rand}@appbarber.app`
  }

  async function loadShops() {
    setLoading(true)
    setSetupError(null)
    const { data, error } = await supabase.rpc('admin_get_all_shops')

    if (error) {
      setShops([])
      if (error.message?.includes('function') || error.message?.includes('not found') || error.code === 'PGRST202') {
        setSetupError(error.message)
      } else {
        toast.error('Erro ao carregar lojas: ' + error.message)
      }
    } else if (data) {
      setShops(data as ShopRow[])
    }
    setLoading(false)
  }

  useEffect(() => { loadShops() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed.length < 2) {
      toast.error('Digite o nome da barbearia')
      return
    }
    if (!password.trim() || password.trim().length < 4) {
      toast.error('A senha deve ter pelo menos 4 caracteres')
      return
    }

    setSaving(true)
    const authEmail = generateAuthEmail(trimmed)

    try {
      // 1. Create auth user via Edge Function
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: password.trim() }),
      })

      let result: { user_id?: string; error?: string }
      try {
        result = await res.json()
      } catch {
        toast.error('Resposta inválida da Edge Function (status ' + res.status + ')')
        setSaving(false)
        return
      }

      if (!res.ok) {
        toast.error('Erro ao criar usuário: ' + (result.error || 'Status ' + res.status))
        setSaving(false)
        return
      }

      if (!result.user_id) {
        toast.error('Resposta inválida: user_id não recebido')
        setSaving(false)
        return
      }

      // 2. Create shop with the new user's ID
      const { error: shopError } = await supabase.rpc('admin_create_shop', {
        shop_name: trimmed,
        owner_id: result.user_id,
        auth_email: authEmail,
      })

      if (shopError) {
        toast.error('Erro ao criar barbearia: ' + shopError.message)
      } else {
        toast.success('Barbearia criada com sucesso!')
        setName('')
        setPassword('')
        setCreateOpen(false)
        loadShops()
      }
    } catch (err) {
      toast.error('Erro de conexão: ' + (err instanceof Error ? err.message : 'Erro'))
    }
    setSaving(false)
  }

  function openEdit(shop: ShopRow) {
    setEditingShop(shop)
    setEditName(shop.name)
    setEditPhone(shop.phone ?? '')
    setEditAddress(shop.address ?? '')
    setEditInstagram(shop.instagram ?? '')
    setEditOpen(true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingShop) return
    setSaving(true)

    const { error } = await supabase.rpc('admin_update_shop', {
      shop_id: editingShop.id,
      shop_name: editName.trim(),
      shop_phone: editPhone.trim() || null,
      shop_address: editAddress.trim() || null,
      shop_instagram: editInstagram.trim() || null,
    })

    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
    } else {
      toast.success('Configurações salvas!')
      setEditOpen(false)
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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger>
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                <Plus className="mr-2 size-4" /> Nova Barbearia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Barbearia</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Barbearia</label>
                  <Input placeholder="Ex: Studio Lima" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Senha de acesso</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Min. 4 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={4}
                      className="border-indigo-500/20 pl-10 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">O barbeiro usará o nome da barbearia + esta senha para entrar.</p>
                </div>

                {name.trim().length >= 2 && (
                  <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Email de login (interno)</p>
                    <code className="font-mono text-sm text-indigo-400">{generateAuthEmail(name)}</code>
                  </div>
                )}

                <Button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                  {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Criando...</> : <><Store className="mr-2 size-4" /> Criar Barbearia</>}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {setupError && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
              <Terminal className="size-4" />
              Setup pendente
            </div>
            <p className="mb-2 text-amber-600/80 dark:text-amber-400/80">
              As funções de admin não existem no banco de dados. Execute o SQL abaixo no Supabase SQL Editor:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-amber-600/90 dark:text-amber-400/90">
              {`1. Abra https://supabase.com/dashboard/project/chtjqqtvvlamrdesaiwp/sql/new
2. Copie o conteúdo de supabase/fix_rpc_only.sql
3. Cole e execute`}
            </pre>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-indigo-500" /></div>
        ) : shops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Store className="mb-3 size-12 opacity-30" />
            <p>Nenhuma barbearia cadastrada</p>
            <p className="mt-1 text-xs">Clique em &ldquo;Nova Barbearia&rdquo; para criar a primeira.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shops.map((shop) => (
              <Card key={shop.id} className="border-indigo-500/10">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{shop.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-indigo-500 hover:text-indigo-400" onClick={() => openEdit(shop)} title="Configurar">
                        <Settings className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(shop.id)} title="Excluir">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                    <span className="text-muted-foreground">ID</span>
                    <button className="flex items-center gap-1 font-mono text-xs text-indigo-500 hover:text-indigo-400" onClick={() => copyId(shop.id)}>
                      {shop.id.slice(0, 8)}&hellip;
                      {copiedId === shop.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                    <span className="text-muted-foreground">Dono</span>
                    <span className="font-mono text-xs">{shop.owner_user_id ? `${shop.owner_user_id.slice(0, 8)}…` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-mono text-xs">{shop.auth_email ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                    <span className="text-muted-foreground">Slug</span>
                    <span className="text-xs">{shop.public_slug ?? '—'}</span>
                  </div>
                  {shop.instagram && (
                    <div className="flex items-center justify-between rounded-lg bg-indigo-500/5 px-3 py-2">
                      <span className="text-muted-foreground">Instagram</span>
                      <span className="text-xs">@{shop.instagram}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurar — {editingShop?.name}</DialogTitle>
            </DialogHeader>
            {editingShop && (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} required minLength={2} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone / WhatsApp</label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="5511999999999" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço</label>
                  <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Rua das Flores, 123" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instagram</label>
                  <Input value={editInstagram} onChange={(e) => setEditInstagram(e.target.value)} placeholder="studiolima" />
                </div>
                <Button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                  {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Salvando...</> : <><Save className="mr-2 size-4" /> Salvar</>}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}

export default AdminPage
