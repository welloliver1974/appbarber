import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { CheckCircle2, XCircle, Calendar, Plus, Trash2, Phone, User, Scissors, CalendarDays, Clock3, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { sendText } from '@/lib/evolution'
import { endOfUTC3DayISO, formatDateTime, formatTime, getUTC3DateKey, startOfUTC3DayISO } from '@/lib/timezone'
import { getAvailableSlots } from '@/lib/availability'
import { useAuth } from '@/providers/AuthProvider'
import type { Appointment, Barber, Service } from '@/types/database'

type AppointmentItem = Appointment & {
  barberName: string
  serviceName: string
  clientName: string
  clientPhone: string
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  confirmed: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

function Appointments() {
  const { shop, loading: shopLoading } = useAuth()
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const selectedService = services.find((s) => s.id === serviceId)

  useEffect(() => {
    load()
  }, [filter, shop?.id, shopLoading])

  useEffect(() => {
    if (shopLoading || !shop) return

    if (barberId && serviceId && date) {
      setTime('')
      setLoadingSlots(true)
      const dur = (selectedService?.duration_minutes ?? 30) + (selectedService?.buffer_minutes ?? 0)
      getAvailableSlots(barberId, date, dur)
        .then((slots) => {
          setAvailableSlots(slots)
          setLoadingSlots(false)
        })
        .catch(() => {
          setAvailableSlots([])
          setLoadingSlots(false)
        })
    } else {
      setAvailableSlots([])
    }
  }, [barberId, serviceId, date, selectedService?.duration_minutes, shop?.id, shopLoading])

  async function load() {
    try {
      if (shopLoading) return
      if (!shop) {
        setAppointments([])
        setBarbers([])
        setServices([])
        setLoading(false)
        return
      }
      setLoading(true)

      let query = supabase.from('appointments').select('*').eq('shop_id', shop.id).order('start_time', { ascending: true })

      if (filter === 'hoje') {
        const today = getUTC3DateKey()
        query = query.gte('start_time', startOfUTC3DayISO(today)).lte('start_time', endOfUTC3DayISO(today))
      }

      const [apptRes, barbersRes, servicesRes] = await Promise.all([
        query,
        supabase.from('barbers').select('*').eq('shop_id', shop.id).order('name'),
        supabase.from('services').select('*').eq('shop_id', shop.id).order('name'),
      ])

      if (apptRes.error) throw apptRes.error
      if (barbersRes.error) throw barbersRes.error
      if (servicesRes.error) throw servicesRes.error

      const barberMap = new Map((barbersRes.data as Barber[]).map((b) => [b.id, b.name]))
      const serviceMap = new Map((servicesRes.data as Service[]).map((s) => [s.id, s.name]))

      const rawAppointments = apptRes.data as Appointment[]
      const clientIds = [...new Set(rawAppointments.map((a) => a.client_id))]
      let clientMap = new Map<string, { id: string; name: string; phone: string }>()
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from('clients').select('id, name, phone').eq('shop_id', shop.id).in('id', clientIds)
        clientMap = new Map((clients ?? []).map((c) => [c.id, c]))
      }

      setAppointments(
        rawAppointments.map((a) => {
          const client = clientMap.get(a.client_id)
          return {
            ...a,
            barberName: barberMap.get(a.barber_id) ?? 'Desconhecido',
            serviceName: serviceMap.get(a.service_id) ?? 'Desconhecido',
            clientName: client?.name ?? 'Desconhecido',
            clientPhone: client?.phone ?? '',
          }
        }),
      )

      setBarbers(barbersRes.data as Barber[])
      setServices(servicesRes.data as Service[])
    } catch (err) {
      toast.error('Erro ao carregar agendamentos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setBarberId('')
    setServiceId('')
    setClientName('')
    setClientPhone('')
    setDate('')
    setTime('')
    setAvailableSlots([])
  }

  function closeDetails() {
    setDetailOpen(false)
    setSelectedAppointment(null)
  }

  function openDetails(apt: AppointmentItem) {
    setSelectedAppointment(apt)
    setDetailOpen(true)
  }

  function durationMinutes(apt: Appointment) {
    return Math.max((new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / 60000, 0)
  }

  async function createAppointment() {
    if (!barberId || !serviceId || !clientName || !clientPhone || !date || !time) {
      toast.error('Preencha todos os campos')
      return
    }
    if (!shop) {
      toast.error('Barbearia ainda não carregada')
      return
    }
    setSaving(true)

    try {
      let clientId = ''
      const { data: existing } = await supabase.from('clients').select('id').eq('shop_id', shop.id).eq('phone', clientPhone).maybeSingle()
      if (existing) {
        clientId = existing.id as string
      } else {
        const { data: newClient } = await supabase.from('clients').insert({ shop_id: shop.id, name: clientName, phone: clientPhone }).select('id').single()
        if (!newClient) throw new Error('Erro ao criar cliente')
        clientId = newClient.id as string
      }

      const slotDur = (selectedService?.duration_minutes ?? 30) + (selectedService?.buffer_minutes ?? 0)
      const stillAvailable = await getAvailableSlots(barberId, date, slotDur)
      if (!stillAvailable.includes(time)) {
        toast.error('Este horário não está mais disponível. Escolha outro.')
        setSaving(false)
        return
      }

      const startTime = new Date(`${date}T${time}:00-03:00`)
      const endTime = new Date(startTime.getTime() + (selectedService?.duration_minutes ?? 30) * 60000)

      await supabase.from('appointments').insert({
        shop_id: shop.id,
        barber_id: barberId,
        service_id: serviceId,
        client_id: clientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmed',
        price_at_booking: selectedService?.price ?? null,
      })

      const barber = barbers.find((b) => b.id === barberId)
      const msg = `🪒 *AppBarber*\n\nOlá ${clientName}, seu agendamento foi confirmado!\n\n📅 ${date} às ${time}\n💈 ${selectedService?.name}\n✂️ ${barber?.name}`
      const sent = await sendText({ number: clientPhone, text: msg, shopId: shop.id })
      if (sent) toast.success('Agendamento criado e WhatsApp enviado!')
      else toast.success('Agendamento criado!')

      resetForm()
      setOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar agendamento')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(apt: AppointmentItem, status: 'pending' | 'confirmed' | 'cancelled' | 'completed') {
    if (!shop) return
    await supabase.from('appointments').update({ status }).eq('id', apt.id)
    toast.success(`Agendamento ${statusLabels[status]?.toLowerCase()}`)

    if (apt.clientPhone) {
      const msg = status === 'completed'
        ? `✅ *AppBarber*\n\nSeu agendamento foi concluído! Obrigado pela preferência.`
        : status === 'cancelled'
        ? `❌ *AppBarber*\n\nSeu agendamento foi cancelado. Entre em contato para reagendar.`
        : `🪒 *AppBarber*\n\nSeu agendamento foi confirmado!`

      const sent = await sendText({ number: apt.clientPhone, text: msg, shopId: shop.id })
      if (!sent) toast.warning('WhatsApp não configurado ou instância offline')
    }

    closeDetails()
    load()
  }

  async function remove(id: string) {
    await supabase.from('appointments').delete().eq('id', id)
    toast.success('Agendamento excluído')
    closeDetails()
    load()
  }

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Calendar className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Agendamentos</h1>
              <p className="text-sm text-muted-foreground">Lista operacional com acesso aos detalhes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
              <SelectTrigger className="w-28 border-indigo-500/20 sm:w-32 focus:ring-indigo-500">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
              <DialogTrigger>
                <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                  <Plus className="mr-2 size-4" /> Novo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Agendamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Barbeiro</label>
                    <Select value={barberId} onValueChange={(v) => v && setBarberId(v)}>
                      <SelectTrigger className="border-indigo-500/20 focus:ring-indigo-500"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {barbers.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Serviço</label>
                    <Select value={serviceId} onValueChange={(v) => v && setServiceId(v)}>
                      <SelectTrigger className="border-indigo-500/20 focus:ring-indigo-500"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cliente</label>
                    <Input placeholder="Nome" value={clientName} onChange={(e) => setClientName(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">WhatsApp</label>
                    <Input placeholder="(11) 99999-8888" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data</label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-indigo-500/20 focus:ring-indigo-500" />
                  </div>
                  {barberId && serviceId && date && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Horário</label>
                      {loadingSlots ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                          <div className="size-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                          Verificando horários...
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-sm text-destructive">Nenhum horário disponível nesta data.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setTime(slot)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                time === slot
                                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                  : 'border-indigo-500/20 text-foreground hover:border-indigo-500/50 hover:bg-indigo-500/10'
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <Button onClick={createAppointment} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500" disabled={saving || !time}>
                    {saving ? 'Criando...' : 'Criar Agendamento'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <ListSkeleton count={3} />
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
              <Calendar className="size-8 text-indigo-400" />
            </div>
            <p className="mb-1 font-medium">Nenhum agendamento</p>
            <p className="text-sm">{filter === 'hoje' ? 'Nenhum agendamento para hoje' : 'Nenhum agendamento encontrado'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt, i) => (
              <Card
                key={apt.id}
                onClick={() => openDetails(apt)}
                className="animate-slide-left cursor-pointer border-indigo-500/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${
                      apt.status === 'completed' ? 'from-green-500 to-emerald-600' :
                      apt.status === 'cancelled' ? 'from-red-500 to-rose-600' :
                      apt.status === 'confirmed' ? 'from-indigo-500 to-blue-600' :
                      'from-amber-500 to-orange-600'
                    } text-white shadow-md`}>
                      <Calendar className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{apt.clientName}</p>
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusColors[apt.status]}`}>
                          {statusLabels[apt.status] ?? apt.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {apt.barberName} · {apt.serviceName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(apt.start_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="hidden rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 sm:inline-flex">
                      Abrir detalhes <ArrowRight className="ml-1 size-3.5" />
                    </span>
                    {apt.status === 'confirmed' && (
                      <>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStatusChange(apt, 'completed') }} title="Concluir" className="text-muted-foreground hover:text-green-500">
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStatusChange(apt, 'cancelled') }} title="Cancelar" className="text-muted-foreground hover:text-destructive">
                          <XCircle className="size-4" />
                        </Button>
                      </>
                    )}
                    {apt.status === 'pending' && (
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStatusChange(apt, 'confirmed') }} title="Confirmar" className="text-muted-foreground hover:text-indigo-500">
                        <CheckCircle2 className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm('Excluir este agendamento?')) remove(apt.id) }} title="Excluir" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={detailOpen} onOpenChange={(v) => (v ? setDetailOpen(true) : closeDetails())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhe do agendamento</DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold">{selectedAppointment.clientName}</p>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusColors[selectedAppointment.status]}`}>
                    {statusLabels[selectedAppointment.status] ?? selectedAppointment.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{selectedAppointment.barberName} · {selectedAppointment.serviceName}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-indigo-500/10 bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <User className="size-3.5" /> Cliente
                  </p>
                  <p className="font-medium">{selectedAppointment.clientName}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-4" /> {selectedAppointment.clientPhone || 'Sem telefone'}
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-500/10 bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Scissors className="size-3.5" /> Atendimento
                  </p>
                  <p className="font-medium">{selectedAppointment.barberName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedAppointment.serviceName}</p>
                </div>
                <div className="rounded-xl border border-indigo-500/10 bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <CalendarDays className="size-3.5" /> Data e horário
                  </p>
                  <p className="font-medium">{formatDateTime(selectedAppointment.start_time)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatTime(selectedAppointment.start_time)} · {durationMinutes(selectedAppointment)} min
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-500/10 bg-card p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Clock3 className="size-3.5" /> Identificação
                  </p>
                  <p className="font-medium">{selectedAppointment.id.slice(0, 8).toUpperCase()}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Criado a partir da agenda operacional</p>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-muted-foreground">
                Este painel concentra as ações principais para que o atendimento possa ser resolvido sem sair da lista.
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedAppointment.status === 'pending' && (
                  <Button onClick={() => handleStatusChange(selectedAppointment, 'confirmed')} className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                    <CheckCircle2 className="mr-2 size-4" /> Confirmar
                  </Button>
                )}
                {selectedAppointment.status === 'confirmed' && (
                  <>
                    <Button onClick={() => handleStatusChange(selectedAppointment, 'completed')} className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md hover:from-green-500 hover:to-emerald-500">
                      <CheckCircle2 className="mr-2 size-4" /> Concluir
                    </Button>
                    <Button variant="secondary" onClick={() => handleStatusChange(selectedAppointment, 'cancelled')}>
                      <XCircle className="mr-2 size-4" /> Cancelar
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => { if (confirm('Excluir este agendamento?')) remove(selectedAppointment.id) }}>
                  <Trash2 className="mr-2 size-4" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}

export default Appointments
