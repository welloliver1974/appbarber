import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ListSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { CheckCircle2, XCircle, Calendar, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { sendText } from '@/lib/evolution'
import { formatDateTime } from '@/lib/timezone'
import type { Appointment, Barber, Service } from '@/types/database'

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  confirmed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

function Appointments() {
  const [appointments, setAppointments] = useState<(Appointment & { barberName: string; serviceName: string; clientName: string; clientPhone: string })[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  useEffect(() => { load() }, [filter])

  async function load() {
    try {
      let query = supabase.from('appointments').select('*').order('start_time', { ascending: true })

      if (filter === 'hoje') {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const end = new Date()
        end.setHours(23, 59, 59, 999)
        query = query.gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
      }

      const [apptRes, barbersRes, servicesRes] = await Promise.all([
        query,
        supabase.from('barbers').select('*').order('name'),
        supabase.from('services').select('*').order('name'),
      ])

      if (apptRes.error) throw apptRes.error
      if (barbersRes.error) throw barbersRes.error
      if (servicesRes.error) throw servicesRes.error

      const barberMap = new Map((barbersRes.data as Barber[]).map((b) => [b.id, b.name]))
      const serviceMap = new Map((servicesRes.data as Service[]).map((s) => [s.id, s.name]))

      const rawAppointments = apptRes.data as Appointment[]

      const clientIds = [...new Set(rawAppointments.map((a) => a.client_id))]
      const { data: clients } = await supabase.from('clients').select('id, name, phone').in('id', clientIds)
      const clientMap = new Map((clients ?? []).map((c: { id: string; name: string; phone: string }) => [c.id, c]))

      setAppointments(rawAppointments.map((a) => {
        const client = clientMap.get(a.client_id)
        return {
          ...a,
          barberName: barberMap.get(a.barber_id) ?? 'Desconhecido',
          serviceName: serviceMap.get(a.service_id) ?? 'Desconhecido',
          clientName: client?.name ?? 'Desconhecido',
          clientPhone: client?.phone ?? '',
        }
      }))

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
  }

  async function createAppointment() {
    if (!barberId || !serviceId || !clientName || !clientPhone || !date || !time) {
      toast.error('Preencha todos os campos')
      return
    }
    setSaving(true)

    try {
      let clientId = ''
      const { data: existing } = await supabase.from('clients').select('id').eq('phone', clientPhone).maybeSingle()
      if (existing) {
        clientId = existing.id as string
      } else {
        const { data: newClient } = await supabase.from('clients').insert({ name: clientName, phone: clientPhone }).select('id').single()
        if (!newClient) throw new Error('Erro ao criar cliente')
        clientId = newClient.id as string
      }

      const selectedService = services.find((s) => s.id === serviceId)
      const startTime = new Date(`${date}T${time}:00`)
      const endTime = new Date(startTime.getTime() + (selectedService?.duration_minutes ?? 30) * 60000)

      await supabase.from('appointments').insert({
        shop_id: '00000000-0000-0000-0000-000000000000',
        barber_id: barberId,
        service_id: serviceId,
        client_id: clientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmed',
      })

      const barber = barbers.find((b) => b.id === barberId)
      const msg = `🪒 *AppBarber*\n\nOlá ${clientName}, seu agendamento foi confirmado!\n\n📅 ${date} às ${time}\n💈 ${selectedService?.name}\n✂️ ${barber?.name}`
      const sent = await sendText({ number: clientPhone, text: msg })
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

  async function updateStatus(apt: Appointment & { clientPhone: string }, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', apt.id)
    toast.success(`Agendamento ${statusLabels[status]?.toLowerCase()}`)

    if (apt.clientPhone) {
      const msg = status === 'completed'
        ? `✅ *AppBarber*\n\nSeu agendamento foi concluído! Obrigado pela preferência.`
        : status === 'cancelled'
        ? `❌ *AppBarber*\n\nSeu agendamento foi cancelado. Entre em contato para reagendar.`
        : `🪒 *AppBarber*\n\nSeu agendamento foi confirmado!`

      const sent = await sendText({ number: apt.clientPhone, text: msg })
      if (!sent) toast.warning('WhatsApp não configurado ou instância offline')
    }

    load()
  }

  async function remove(id: string) {
    await supabase.from('appointments').delete().eq('id', id)
    toast.success('Agendamento excluído')
    load()
  }

  return (
    <PageTransition>
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Agendamentos</h1>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
            <SelectTrigger className="w-28 sm:w-32">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
            <DialogTrigger><Button><Plus className="mr-2 size-4" /> Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Barbeiro</label>
                  <Select value={barberId} onValueChange={(v) => v && setBarberId(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente</label>
                  <Input placeholder="Nome" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">WhatsApp</label>
                  <Input placeholder="(11) 99999-8888" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data</label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Horário</label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                </div>
                <Button onClick={createAppointment} className="w-full" disabled={saving}>
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
          <Calendar className="mb-4 size-12" />
          <p className="mb-1 font-medium">Nenhum agendamento</p>
          <p className="text-sm">{filter === 'hoje' ? 'Nenhum agendamento para hoje' : 'Nenhum agendamento encontrado'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt, i) => (
            <Card key={apt.id} className="animate-slide-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ animationDelay: `${i * 80}ms` }}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <p className="font-medium">{apt.clientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {apt.barberName} · {apt.serviceName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(apt.start_time)}
                  </p>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusColors[apt.status]}`}>
                    {statusLabels[apt.status] ?? apt.status}
                  </span>
                </div>
                <div className="flex gap-1">
                  {apt.status === 'confirmed' && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => updateStatus(apt, 'completed')} title="Concluir">
                        <CheckCircle2 className="size-4 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => updateStatus(apt, 'cancelled')} title="Cancelar">
                        <XCircle className="size-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  {apt.status === 'pending' && (
                    <Button variant="ghost" size="icon" onClick={() => updateStatus(apt, 'confirmed')} title="Confirmar">
                      <CheckCircle2 className="size-4 text-blue-500" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir este agendamento?')) remove(apt.id) }} title="Excluir">
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
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

export default Appointments
