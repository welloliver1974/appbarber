import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Plus, Pencil, Trash2, Phone, User, Search, ArrowDownAZ, Clock3, Mail, StickyNote, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/timezone'
import { useAuth } from '@/providers/AuthProvider'
import type { Client } from '@/types/database'

type ClientSort = 'name' | 'recent'

// ─── Schema ────────────────────────────────────────────────────────────────────
const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z
    .string()
    .regex(/^\d{10,15}$/, 'Formato inválido. Use código do país + DDD + número (ex: 5511999999999)'),
  email: z.string().email('Formato de e-mail inválido').or(z.literal('')),
  notes: z.string().max(300, 'Notas muito longas').or(z.literal('')),
})

type ClientFormValues = z.infer<typeof clientSchema>

// ─── Component ─────────────────────────────────────────────────────────────────
function Clients() {
  const { shop, loading: shopLoading } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<ClientSort>('name')

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      notes: '',
    },
  })

  useEffect(() => {
    load()
  }, [shop?.id, shopLoading])

  const visibleClients = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = clients.filter((client) => {
      const haystack = [client.name, client.phone, client.email ?? '', client.notes ?? ''].join(' ').toLowerCase()
      return !q || haystack.includes(q)
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [clients, query, sortBy])

  async function load() {
    if (shopLoading) return
    if (!shop) {
      setClients([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data } = await supabase.from('clients').select('*').eq('shop_id', shop.id).order('name')
      if (data) setClients(data as Client[])
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    form.reset({
      name: '',
      phone: '',
      email: '',
      notes: '',
    })
    setEditing(null)
  }

  async function onSubmit(values: ClientFormValues) {
    if (!shop) return
    const payload = {
      shop_id: shop.id,
      name: values.name.trim(),
      phone: values.phone.replace(/\D/g, ''),
      email: values.email.trim() || null,
      notes: values.notes.trim() || null,
    }

    try {
      if (editing) {
        const { error } = await supabase.from('clients').update(payload).eq('id', editing.id).eq('shop_id', shop.id)
        if (error) throw error
        toast.success('Cliente atualizado')
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
        toast.success('Cliente cadastrado')
      }
      reset()
      setOpen(false)
      load()
    } catch (err) {
      toast.error('Erro ao salvar cliente')
      console.error(err)
    }
  }

  async function remove(id: string) {
    if (!shop) return
    if (!confirm('Deseja realmente remover este cliente?')) return
    const { error } = await supabase.from('clients').delete().eq('id', id).eq('shop_id', shop.id)
    if (error) {
      toast.error('Erro ao remover cliente')
    } else {
      toast.success('Cliente removido')
      load()
    }
  }

  function edit(client: Client) {
    setEditing(client)
    form.reset({
      name: client.name,
      phone: client.phone,
      email: client.email ?? '',
      notes: client.notes ?? '',
    })
    setOpen(true)
  }

  const noteCount = clients.filter((client) => Boolean(client.notes)).length
  const emailCount = clients.filter((client) => Boolean(client.email)).length

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
              <User className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Clientes</h1>
              <p className="text-sm text-muted-foreground">Busque rápido, edite em poucos cliques e veja o histórico essencial</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
            <DialogTrigger>
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                <Plus className="mr-2 size-4" /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 5511999999999" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Código do país + DDD + número. Sem espaços ou traços.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="seu@email.com" type="email" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Notas operacionais ou preferências" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={form.formState.isSubmitting} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                    {form.formState.isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" /> Salvando...</> : 'Salvar'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Total', value: clients.length, border: 'border-sky-500/20', from: 'from-sky-500', to: 'to-indigo-600' },
            { label: 'Com e-mail', value: emailCount, border: 'border-violet-500/20', from: 'from-violet-500', to: 'to-indigo-600' },
            { label: 'Com notas', value: noteCount, border: 'border-indigo-500/20', from: 'from-indigo-500', to: 'to-blue-600' },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border bg-card p-4 shadow-sm ${item.border}`}>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-bold">{item.value}</p>
              <div className={`mt-3 h-1 w-16 rounded-full bg-gradient-to-r ${item.from} ${item.to}`} />
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 border-indigo-500/20 focus:ring-indigo-500"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as ClientSort)}>
            <SelectTrigger className="w-40 border-indigo-500/20 focus:ring-indigo-500">
              <ArrowDownAZ className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="Ordenar">
                {(value) => ({ name: 'Nome (A-Z)', recent: 'Recentes' })[value as ClientSort] ?? 'Ordenar'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome (A-Z)</SelectItem>
              <SelectItem value="recent">Recentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <ListSkeleton count={4} />
        ) : visibleClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-500/15 bg-indigo-500/5 py-16 text-muted-foreground">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
              <User className="size-8 text-indigo-400" />
            </div>
            <p className="mb-1 font-medium">{query ? 'Nenhum resultado encontrado' : 'Nenhum cliente ainda'}</p>
            <p className="text-sm">{query ? 'Tente outro termo de busca' : 'Clique em "Novo Cliente" para começar'}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleClients.map((client, i) => (
              <Card key={client.id} className="animate-fade-in border-indigo-500/10 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5" style={{ animationDelay: `${i * 60}ms` }}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/20 to-indigo-600/20 text-indigo-600 dark:text-indigo-400">
                        <User className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="size-3" />
                          <span>{client.phone}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.notes && (
                      <div className="flex items-start gap-2">
                        <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                        <span className="line-clamp-2 leading-relaxed">{client.notes}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground/60">
                      <Clock3 className="size-3" />
                      <span>Cadastrado em {formatDate(client.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 border-t border-indigo-500/5 pt-3">
                    <Button variant="ghost" size="icon" onClick={() => edit(client)} className="text-muted-foreground hover:text-indigo-600">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(client.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
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

export default Clients
