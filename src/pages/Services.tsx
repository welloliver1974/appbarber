import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Plus, Pencil, Trash2, Scissors, Clock, Search, Filter, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import type { Service } from '@/types/database'

type ServiceFilter = 'all' | 'active' | 'inactive'

function Services() {
  const { shop, loading: shopLoading } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('30')
  const [buffer, setBuffer] = useState('0')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ServiceFilter>('all')

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
    setName('')
    setPrice('')
    setDuration('30')
    setBuffer('0')
    setEditing(null)
  }

  async function save() {
    if (!shop || !name.trim() || !price) return
    const payload = {
      name: name.trim(),
      price: parseFloat(price),
      duration_minutes: parseInt(duration, 10),
      buffer_minutes: parseInt(buffer, 10) || 0,
      shop_id: shop.id,
    }
    if (editing) {
      await supabase.from('services').update(payload).eq('id', editing.id)
      toast.success('Serviço atualizado')
    } else {
      await supabase.from('services').insert(payload)
      toast.success('Serviço cadastrado')
    }
    reset()
    setOpen(false)
    load()
  }

  async function remove(id: string) {
    await supabase.from('services').delete().eq('id', id)
    toast.success('Serviço removido')
    load()
  }

  function edit(service: Service) {
    setEditing(service)
    setName(service.name)
    setPrice(String(service.price))
    setDuration(String(service.duration_minutes))
    setBuffer(String(service.buffer_minutes ?? 0))
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
              <div className="space-y-4">
                <Input placeholder="Nome do serviço" value={name} onChange={(e) => setName(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                <Input placeholder="Preço (R$)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                <Input placeholder="Duração (min)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                <Input placeholder="Tempo de limpeza / Buffer (min)" type="number" value={buffer} onChange={(e) => setBuffer(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                <Button onClick={save} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">Salvar</Button>
              </div>
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
