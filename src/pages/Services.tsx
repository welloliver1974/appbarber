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
import { Checkbox } from '@/components/ui/checkbox'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Plus, Pencil, Trash2, Scissors, Clock, Search, Filter, DollarSign, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import type { Service } from '@/types/database'

type ServiceFilter = 'all' | 'active' | 'inactive'

// ─── Schema ────────────────────────────────────────────────────────────────────
const serviceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Preço inválido. Deve ser maior que 0',
  }),
  duration_minutes: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0, {
    message: 'Duração inválida. Deve ser maior que 0 min',
  }),
  buffer_minutes: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0, {
    message: 'Buffer inválido. Deve ser maior ou igual a 0 min',
  }),
  is_combo: z.boolean().optional(),
})

type ServiceFormValues = z.infer<typeof serviceSchema>

// ─── Component ─────────────────────────────────────────────────────────────────
function Services() {
  const { shop, loading: shopLoading } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ServiceFilter>('all')

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      price: '',
      duration_minutes: '30',
      buffer_minutes: '0',
      is_combo: false,
    },
  })

  useEffect(() => {
    load()
  }, [shop?.id, shopLoading])

  const visibleServices = useMemo(() => {
    const q = query.trim().toLowerCase()
    return services.filter((service) => {
      const matchesQuery = !q || service.name.toLowerCase().includes(q)
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'active'
            ? service.active
            : !service.active
      return matchesQuery && matchesFilter
    })
  }, [services, query, filter])

  async function load() {
    if (shopLoading) return
    if (!shop) {
      setServices([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data } = await supabase.from('services').select('*').eq('shop_id', shop.id).order('name')
      if (data) setServices(data as Service[])
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    form.reset({
      name: '',
      price: '',
      duration_minutes: '30',
      buffer_minutes: '0',
    })
    setEditing(null)
  }

  async function onSubmit(values: ServiceFormValues) {
    if (!shop) return
    const payload = {
      name: values.name.trim(),
      price: parseFloat(values.price),
      duration_minutes: parseInt(values.duration_minutes, 10),
      buffer_minutes: parseInt(values.buffer_minutes, 10) || 0,
      is_combo: values.is_combo ?? false,
      shop_id: shop.id,
    }

    try {
      if (editing) {
        const { error } = await supabase.from('services').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Serviço atualizado')
      } else {
        const { error } = await supabase.from('services').insert(payload)
        if (error) throw error
        toast.success('Serviço cadastrado')
      }
      reset()
      setOpen(false)
      load()
    } catch (err) {
      toast.error('Erro ao salvar o serviço')
      console.error(err)
    }
  }

  async function remove(id: string) {
    if (!confirm('Deseja realmente remover este serviço?')) return
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao remover serviço')
    } else {
      toast.success('Serviço removido')
      load()
    }
  }

  function edit(service: Service) {
    setEditing(service)
    form.reset({
      name: service.name,
      price: String(service.price),
      duration_minutes: String(service.duration_minutes),
      buffer_minutes: String(service.buffer_minutes ?? 0),
      is_combo: service.is_combo ?? false,
    })
    setOpen(true)
  }

  const currency = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
              <Scissors className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Serviços</h1>
              <p className="text-sm text-muted-foreground">Catálogo com preço, duração e status operacional</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
            <DialogTrigger>
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                <Plus className="mr-2 size-4" /> Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do serviço</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Corte de Cabelo" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço (R$)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 50.00" type="number" step="0.01" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duração (minutos)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 30" type="number" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buffer_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tempo de limpeza / Buffer (minutos)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 5" type="number" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_combo"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                            className="border-indigo-500/30 focus:ring-indigo-500 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                          />
                        </FormControl>
                        <FormLabel className="mb-0 cursor-pointer">Combo (pacote de serviços)</FormLabel>
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
            { label: 'Total', value: services.length, border: 'border-violet-500/20', from: 'from-violet-500', to: 'to-indigo-600' },
            { label: 'Ativos', value: services.filter((s) => s.active).length, border: 'border-emerald-500/20', from: 'from-emerald-500', to: 'to-green-600' },
            { label: 'Ticket médio', value: services.length ? currency.format(services.reduce((acc, s) => acc + Number(s.price), 0) / services.length) : 'R$ 0,00', border: 'border-indigo-500/20', from: 'from-indigo-500', to: 'to-blue-600' },
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
              placeholder="Buscar serviço..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 border-indigo-500/20 focus:ring-indigo-500"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as ServiceFilter)}>
            <SelectTrigger className="w-40 border-indigo-500/20 focus:ring-indigo-500">
              <Filter className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="Filtro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          {(query || filter !== 'all') && (
            <Button variant="ghost" onClick={() => { setQuery(''); setFilter('all') }} className="text-muted-foreground hover:text-indigo-600">
              Limpar filtros
            </Button>
          )}
        </div>

        {loading ? (
          <ListSkeleton count={4} />
        ) : visibleServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-500/15 bg-indigo-500/5 py-16 text-muted-foreground">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
              <Scissors className="size-8 text-indigo-400" />
            </div>
            <p className="mb-1 font-medium">{query || filter !== 'all' ? 'Nenhum resultado encontrado' : 'Nenhum serviço ainda'}</p>
            <p className="text-sm">{query || filter !== 'all' ? 'Tente outro termo ou limpe os filtros' : 'Clique em "Novo Serviço" para começar'}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleServices.map((service, i) => (
              <Card key={service.id} className="animate-fade-in border-indigo-500/10 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5" style={{ animationDelay: `${i * 60}ms` }}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 text-indigo-600 dark:text-indigo-400">
                        <Clock className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full px-2.5 py-1 ${service.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                            {service.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-indigo-600 dark:text-indigo-400">
                            {service.duration_minutes} min
                          </span>
                          {service.buffer_minutes ? (
                            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-600 dark:text-amber-400">
                              +{service.buffer_minutes} min limpeza
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="size-4" />
                    <span>{currency.format(Number(service.price))}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => edit(service)} className="text-muted-foreground hover:text-indigo-600">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(service.id)} className="text-muted-foreground hover:text-destructive">
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

export default Services
