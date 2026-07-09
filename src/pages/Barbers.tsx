import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Plus, Pencil, Trash2, Users, Clock, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import type { Barber, BarberAvailability } from '@/types/database'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type BarberFilter = 'all' | 'active' | 'inactive'

function Barbers() {
  const { shop, loading: shopLoading } = useAuth()
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Barber | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BarberFilter>('all')
  const [availabilityCount, setAvailabilityCount] = useState<Record<string, number>>({})

  const [availOpen, setAvailOpen] = useState(false)
  const [availBarber, setAvailBarber] = useState<Barber | null>(null)
  const [availData, setAvailData] = useState<Record<number, { on: boolean; start: string; end: string }>>({})

  useEffect(() => {
    load()
  }, [shop?.id, shopLoading])

  const visibleBarbers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return barbers.filter((barber) => {
      const matchesQuery = !q || barber.name.toLowerCase().includes(q)
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'active'
            ? barber.active
            : !barber.active
      return matchesQuery && matchesFilter
    })
  }, [barbers, query, filter])

  async function load() {
    if (shopLoading) return
    if (!shop) {
      setBarbers([])
      setAvailabilityCount({})
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [barbersRes, availabilityRes] = await Promise.all([
        supabase.from('barbers').select('*').eq('shop_id', shop.id).order('name'),
        supabase.from('barber_availability').select('barber_id, day_of_week'),
      ])

      if (barbersRes.data) setBarbers(barbersRes.data as Barber[])

      const counts: Record<string, number> = {}
      for (const row of (availabilityRes.data as BarberAvailability[] | null) ?? []) {
        counts[row.barber_id] = (counts[row.barber_id] ?? 0) + 1
      }
      setAvailabilityCount(counts)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!shop || !name.trim()) return
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
    }
    if (editing) {
      await supabase.from('barbers').update(payload).eq('id', editing.id)
      toast.success('Barbeiro atualizado')
    } else {
      await supabase.from('barbers').insert({ ...payload, shop_id: shop.id })
      toast.success('Barbeiro cadastrado')
    }
    setName('')
    setPhone('')
    setEditing(null)
    setOpen(false)
    load()
  }

  async function remove(id: string) {
    await supabase.from('barbers').delete().eq('id', id)
    toast.success('Barbeiro removido')
    load()
  }

  function edit(barber: Barber) {
    setEditing(barber)
    setName(barber.name)
    setPhone(barber.phone ?? '')
    setOpen(true)
  }

  async function openAvail(barber: Barber) {
    setAvailBarber(barber)
    const { data } = await supabase.from('barber_availability').select('*').eq('barber_id', barber.id)
    const items = (data as BarberAvailability[]) ?? []
    const map: Record<number, { on: boolean; start: string; end: string }> = {}
    for (let d = 0; d < 7; d++) {
      const found = items.find((a) => a.day_of_week === d)
      map[d] = found ? { on: true, start: found.start_time.slice(0, 5), end: found.end_time.slice(0, 5) } : { on: d >= 1 && d <= 5, start: '09:00', end: '18:00' }
    }
    setAvailData(map)
    setAvailOpen(true)
  }

  async function saveAvail() {
    if (!availBarber) return
    const toInsert: { barber_id: string; day_of_week: number; start_time: string; end_time: string }[] = []
    for (let d = 0; d < 7; d++) {
      const entry = availData[d]
      if (entry?.on) {
        toInsert.push({ barber_id: availBarber.id, day_of_week: d, start_time: `${entry.start}:00`, end_time: `${entry.end}:00` })
      }
    }

    await supabase.from('barber_availability').delete().eq('barber_id', availBarber.id)
    if (toInsert.length > 0) {
      await supabase.from('barber_availability').insert(toInsert)
    }
    toast.success('Horários salvos!')
    setAvailOpen(false)
    load()
  }

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Barbeiros</h1>
              <p className="text-sm text-muted-foreground">Lista com disponibilidade e acesso rápido aos horários</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setName(''); setPhone('') } }}>
            <DialogTrigger>
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                <Plus className="mr-2 size-4" /> Novo Barbeiro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Barbeiro' : 'Novo Barbeiro'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input placeholder="Nome do barbeiro" value={name} onChange={(e) => setName(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone (WhatsApp)</label>
                  <Input placeholder="Ex: 5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                  <p className="text-xs text-muted-foreground">Para notificações de novos agendamentos.</p>
                </div>
                <Button onClick={save} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Total', value: barbers.length, border: 'border-indigo-500/20', from: 'from-indigo-500', to: 'to-blue-600' },
            { label: 'Ativos', value: barbers.filter((b) => b.active).length, border: 'border-emerald-500/20', from: 'from-emerald-500', to: 'to-green-600' },
            { label: 'Com horários', value: Object.keys(availabilityCount).length, border: 'border-violet-500/20', from: 'from-violet-500', to: 'to-indigo-600' },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border bg-card p-4 shadow-sm ${item.border}`}>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-3xl font-bold">{item.value}</p>
              <div className={`mt-3 h-1 w-16 rounded-full bg-gradient-to-r ${item.from} ${item.to}`} />
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar barbeiro..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 border-indigo-500/20 focus:ring-indigo-500"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as BarberFilter)}>
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
        ) : visibleBarbers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-500/15 bg-indigo-500/5 py-16 text-muted-foreground">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
              <Users className="size-8 text-indigo-400" />
            </div>
            <p className="mb-1 font-medium">{query || filter !== 'all' ? 'Nenhum resultado encontrado' : 'Nenhum barbeiro ainda'}</p>
            <p className="text-sm">{query || filter !== 'all' ? 'Tente outro termo ou limpe os filtros' : 'Clique em "Novo Barbeiro" para começar'}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleBarbers.map((barber, i) => (
              <Card key={barber.id} className="animate-fade-in border-indigo-500/10 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5" style={{ animationDelay: `${i * 60}ms` }}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-600/20 text-indigo-600 dark:text-indigo-400">
                        <Users className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">{barber.name}</p>
                        {barber.phone && (
                          <p className="text-xs text-muted-foreground">{barber.phone}</p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full px-2.5 py-1 ${barber.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                            {barber.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-indigo-600 dark:text-indigo-400">
                            {availabilityCount[barber.id] ?? 0} dias
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openAvail(barber)} title="Horários" className="text-muted-foreground hover:text-indigo-600">
                      <Clock className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => edit(barber)} className="text-muted-foreground hover:text-indigo-600">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(barber.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={availOpen} onOpenChange={setAvailOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Horários — {availBarber?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {DAYS.map((day, d) => {
                const entry = availData[d]
                if (!entry) return null
                return (
                  <div key={d} className="flex items-center gap-3 rounded-lg border border-indigo-500/10 p-3">
                    <label className="flex w-20 cursor-pointer items-center gap-2 text-sm font-medium">
                      <input type="checkbox" checked={entry.on} onChange={() => setAvailData((prev) => ({ ...prev, [d]: { ...prev[d], on: !prev[d].on } }))} className="size-4 accent-indigo-600" />
                      {day}
                    </label>
                    {entry.on && (
                      <div className="flex items-center gap-2">
                        <Input type="time" value={entry.start} onChange={(e) => setAvailData((prev) => ({ ...prev, [d]: { ...prev[d], start: e.target.value } }))} className="h-8 w-24 border-indigo-500/20 text-xs focus:ring-indigo-500" />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input type="time" value={entry.end} onChange={(e) => setAvailData((prev) => ({ ...prev, [d]: { ...prev[d], end: e.target.value } }))} className="h-8 w-24 border-indigo-500/20 text-xs focus:ring-indigo-500" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <Button onClick={saveAvail} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">Salvar Horários</Button>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}

export default Barbers
