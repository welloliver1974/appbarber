import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Scissors, CheckCircle } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { sendText } from '@/lib/evolution'
import type { Barber, Service } from '@/types/database'

function Booking() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      const [barbersRes, servicesRes] = await Promise.all([
        supabase.from('barbers').select('*').eq('active', true).order('name'),
        supabase.from('services').select('*').eq('active', true).order('name'),
      ])
      if (barbersRes.data) setBarbers(barbersRes.data as Barber[])
      if (servicesRes.data) setServices(servicesRes.data as Service[])
      setLoading(false)
    }
    load()
  }, [])

  const selectedService = services.find((s) => s.id === serviceId)
  const selectedBarber = barbers.find((b) => b.id === barberId)

  function reset() {
    setBarberId('')
    setServiceId('')
    setDate('')
    setTime('')
    setName('')
    setPhone('')
    setSuccess(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!barberId || !serviceId || !date || !time || !name || !phone) return
    setSaving(true)
    setError('')

    try {
      let clientId = ''
      const { data: existing } = await supabase.from('clients').select('id').eq('phone', phone).maybeSingle()
      if (existing) {
        clientId = existing.id as string
      } else {
        const { data: newClient } = await supabase.from('clients').insert({ name, phone }).select('id').single()
        if (!newClient) throw new Error('Erro ao criar cliente')
        clientId = newClient.id as string
      }

      const startTime = new Date(`${date}T${time}:00`)
      const endTime = new Date(startTime.getTime() + (selectedService?.duration_minutes ?? 30) * 60000)

      await supabase.from('appointments').insert({
        shop_id: '00000000-0000-0000-0000-000000000000',
        barber_id: barberId,
        service_id: serviceId,
        client_id: clientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'pending',
      })

      const msg = [
        `🪒 *AppBarber*`,
        ``,
        `Olá ${name}, seu agendamento foi confirmado!`,
        ``,
        `📅 ${date} às ${time}`,
        `💈 ${selectedService?.name ?? 'Serviço'}`,
        `✂️ ${selectedBarber?.name ?? 'Barbeiro'}`,
      ].join('\n')

      const sent = await sendText({ number: phone, text: msg })
      if (sent) toast.success('Confirmação enviada via WhatsApp')
      else toast.warning('Agendamento criado, mas WhatsApp não configurado')

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao agendar')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <CheckCircle className="mx-auto mb-4 size-16 text-green-500" />
            <h2 className="mb-2 text-xl font-bold">Agendamento Confirmado!</h2>
            <p className="mb-6 text-muted-foreground">
              Seu horário foi reservado. Você receberá a confirmação no WhatsApp.
            </p>
            <Button onClick={reset}>Novo Agendamento</Button>
          </CardContent>
        </Card>
        <Toaster richColors />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Scissors className="mx-auto mb-2 size-8" />
          <CardTitle className="text-xl">Agendar Horário</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Barbeiro</label>
                <Select value={barberId} onValueChange={(v) => v && setBarberId(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o barbeiro" /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — R$ {Number(s.price).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedService && (
                  <p className="text-xs text-muted-foreground">Duração: {selectedService.duration_minutes}min</p>
                )}
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp</label>
                <Input placeholder="(11) 99999-8888" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={saving || loading}>
                {saving ? 'Agendando...' : 'Confirmar Agendamento'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Toaster richColors />
    </div>
  )
}

export default Booking
