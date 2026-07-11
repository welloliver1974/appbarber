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
import { Plus, Pencil, Trash2, Users, Clock, Search, Filter, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { useBarberPush } from '@/hooks/useBarberPush'
import { ensureGalleryBucket, uploadBarberPhoto, uploadBarberPortfolioPhoto, deletePhoto } from '@/lib/storage'
import type { Barber, BarberAvailability } from '@/types/database'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type BarberFilter = 'all' | 'active' | 'inactive'

// ─── Schema ────────────────────────────────────────────────────────────────────
const barberSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z
    .string()
    .regex(/^\d{10,15}$/, 'Formato inválido. Use código do país + DDD + número (ex: 5511999999999)')
    .or(z.literal('')),
  bio: z.string().max(300, 'Bio muito longa').or(z.literal('')),
  photo_url: z.string().or(z.literal('')),
})

type BarberFormValues = z.infer<typeof barberSchema>

// ─── Component ─────────────────────────────────────────────────────────────────
function Barbers() {
  const { shop, loading: shopLoading } = useAuth()
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Barber | null>(null)
  const { enabled: pushEnabled, toggle: togglePush, loading: pushLoading } = useBarberPush(editing?.id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BarberFilter>('all')
  const [availabilityCount, setAvailabilityCount] = useState<Record<string, number>>({})

  const [availOpen, setAvailOpen] = useState(false)
  const [availBarber, setAvailBarber] = useState<Barber | null>(null)
  const [availData, setAvailData] = useState<Record<number, { on: boolean; start: string; end: string }>>({})

  const [newPortfolioPhotos, setNewPortfolioPhotos] = useState<string[]>([])

  const form = useForm<BarberFormValues>({
    resolver: zodResolver(barberSchema),
    defaultValues: {
      name: '',
      phone: '',
    },
  })

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        phone: editing.phone ?? '',
        bio: editing.bio ?? '',
        photo_url: editing.photo_url ?? '',
      })
    }
  }, [editing, form])

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

  function reset() {
    form.reset({
      name: '',
      phone: '',
      bio: '',
      photo_url: '',
    })
    setEditing(null)
    setNewPortfolioPhotos([])
  }

  async function onSubmit(values: BarberFormValues) {
    if (!shop) return
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      phone: values.phone.trim() || null,
      bio: values.bio.trim() || null,
      photo_url: values.photo_url.trim() || null,
      portfolio_photos: newPortfolioPhotos.length > 0 ? newPortfolioPhotos : null,
    }

    try {
      if (editing) {
        const { error } = await supabase.from('barbers').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Barbeiro atualizado')
      } else {
        const { error } = await supabase.from('barbers').insert({ ...payload, shop_id: shop.id })
        if (error) throw error
        toast.success('Barbeiro cadastrado')
      }
      reset()
      setOpen(false)
      load()
    } catch (err) {
      toast.error('Erro ao salvar barbeiro')
      console.error(err)
    }
  }

  async function remove(id: string) {
    if (!confirm('Deseja realmente remover este barbeiro?')) return
    const { error } = await supabase.from('barbers').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao remover barbeiro')
    } else {
      toast.success('Barbeiro removido')
      load()
    }
  }

  function edit(barber: Barber) {
    setEditing(barber)
    setNewPortfolioPhotos(barber.portfolio_photos ?? [])
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
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
            <DialogTrigger>
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                <Plus className="mr-2 size-4" /> Novo Barbeiro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Barbeiro' : 'Novo Barbeiro'}</DialogTitle>
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
                          <Input placeholder="Nome do barbeiro" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
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
                        <FormLabel>Telefone (WhatsApp)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 5511999999999" className="border-indigo-500/20 focus:ring-indigo-500" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Para notificações de novos agendamentos.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={pushEnabled}
                        disabled={pushLoading}
                        onChange={(e) => {
                          const checked = e.target.checked
                          togglePush(checked)
                        }}
                        className="size-4 rounded border-indigo-500/30 text-indigo-600 focus:ring-indigo-500"
                      />
                    </FormControl>
                    <FormLabel>Ativar notificações de navegador</FormLabel>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="photo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Foto de Perfil</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {field.value ? (
                              <div className="relative inline-block">
                                <img src={field.value} alt="Preview" className="size-20 rounded-full border-2 border-indigo-500/20 object-cover" />
                              </div>
                            ) : null}
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2 text-sm text-muted-foreground transition hover:bg-indigo-500/10">
                              <Upload className="size-4 text-indigo-500" />
                              {field.value ? 'Trocar foto' : 'Fazer upload'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0]
                                  if (!file || !shop) return
                                  await ensureGalleryBucket()
                                  try {
                                    const barberId = editing?.id || 'new'
                                    const url = await uploadBarberPhoto(shop.id, barberId, file)
                                    if (url) {
                                      field.onChange(url)
                                      toast.success('Foto enviada!')
                                    }
                                  } catch (err) {
                                    toast.error('Erro no upload')
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biografia</FormLabel>
                        <FormControl>
                          <textarea
                            placeholder="Fale sobre o barbeiro..."
                            rows={3}
                            className="w-full rounded-lg border border-indigo-500/20 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Máximo 300 caracteres. Exibida no site público.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* ── Portfolio Photos ── */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Galeria de Trabalhos</p>
                    {newPortfolioPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {newPortfolioPhotos.map((url, idx) => (
                          <div key={idx} className="group relative overflow-hidden rounded-lg border border-white/10">
                            <img src={url} alt={`Trabalho ${idx + 1}`} className="aspect-square w-full object-cover" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0.5 top-0.5 size-6 bg-black/50 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
                              onClick={async () => {
                                if (url.startsWith(supabase.storage.from('gallery').getPublicUrl('').data?.publicUrl ?? '')) {
                                  await deletePhoto(url)
                                }
                                setNewPortfolioPhotos(newPortfolioPhotos.filter((_, i) => i !== idx))
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2 text-sm text-muted-foreground transition hover:bg-indigo-500/10">
                      <Upload className="size-4 text-indigo-500" /> Adicionar foto
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file || !shop) return
                          await ensureGalleryBucket()
                          try {
                            const url = await uploadBarberPortfolioPhoto(shop.id, file)
                            if (url) {
                              setNewPortfolioPhotos([...newPortfolioPhotos, url])
                              toast.success('Foto adicionada!')
                            }
                          } catch (err) {
                            toast.error('Erro no upload')
                          }
                        }}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">Fotos dos trabalhos realizados, exibidas no site público.</p>
                  </div>

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
