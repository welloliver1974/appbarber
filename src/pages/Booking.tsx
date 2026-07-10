import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Scissors, CheckCircle, Sparkles, ChevronLeft, User, Phone, Sun, Moon, Clock, CalendarDays, BadgeCheck, Info } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { sendText } from '@/lib/evolution'
import { getAvailableSlots } from '@/lib/availability'
import { getUTC3DateKey } from '@/lib/timezone'
import { useAuth } from '@/providers/AuthProvider'
import type { Barber, Service } from '@/types/database'

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function formatPhoneInput(value: string) {
  const digits = normalizePhone(value).slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function buildISO(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`)
}

function Booking() {
  const { shop, loading: shopLoading } = useAuth()
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
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [step, setStep] = useState(1)

  useEffect(() => {
    if (shopLoading) return
    if (!shop) {
      setBarbers([])
      setServices([])
      setLoading(false)
      return
    }

    async function load() {
      const activeShop = shop
      if (!activeShop) {
        setLoading(false)
        return
      }

      const [barbersRes, servicesRes] = await Promise.all([
        supabase.from('barbers').select('*').eq('shop_id', activeShop.id).eq('active', true).order('name'),
        supabase.from('services').select('*').eq('shop_id', activeShop.id).eq('active', true).order('name'),
      ])
      if (barbersRes.data) setBarbers(barbersRes.data as Barber[])
      if (servicesRes.data) setServices(servicesRes.data as Service[])
      setLoading(false)
    }
    load()
  }, [shop?.id, shopLoading])

  const selectedService = services.find((s) => s.id === serviceId)
  const selectedBarber = barbers.find((b) => b.id === barberId)

  const bookingSummary = useMemo(() => {
    const duration = selectedService?.duration_minutes ?? 0
    return {
      barberName: selectedBarber?.name ?? 'Barbeiro não selecionado',
      serviceName: selectedService?.name ?? 'Serviço não selecionado',
      duration,
      timeLabel: time || 'Horário pendente',
      dateLabel: date || 'Data pendente',
      phoneLabel: normalizePhone(phone) ? formatPhoneInput(phone) : 'WhatsApp pendente',
    }
  }, [selectedBarber?.name, selectedService?.name, selectedService?.duration_minutes, date, time, phone])

  useEffect(() => {
    if (shopLoading || !shop) return

    if (barberId && serviceId && date) {
      setTime('')
      setLoadingSlots(true)
      const dur = (selectedService?.duration_minutes ?? 30) + (selectedService?.buffer_minutes ?? 0)
      getAvailableSlots(barberId, date, dur).then((slots) => {
        setAvailableSlots(slots)
        setLoadingSlots(false)
      }).catch(() => {
        setAvailableSlots([])
        setLoadingSlots(false)
      })
    } else {
      setAvailableSlots([])
    }
  }, [barberId, serviceId, date, selectedService?.duration_minutes, shop?.id, shopLoading])

  function canProceed(stepNum: number) {
    switch (stepNum) {
      case 1: return !!barberId && !!serviceId
      case 2: return !!date && !!time
      case 3: return !!name.trim() && normalizePhone(phone).length >= 10
      default: return false
    }
  }

  function nextStep() {
    if (step === 1 && canProceed(1)) { setStep(2); return }
    if (step === 2 && canProceed(2)) { setStep(3); return }
  }

  function reset() {
    setBarberId('')
    setServiceId('')
    setDate('')
    setTime('')
    setName('')
    setPhone('')
    setSuccess(false)
    setError('')
    setStep(1)
    setAvailableSlots([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanPhone = normalizePhone(phone)
    if (!barberId || !serviceId || !date || !time || !name.trim() || cleanPhone.length < 10) return
    if (!shop) {
      setError('Barbearia ainda não carregada')
      return
    }
    setSaving(true)
    setError('')

    try {
      const slotDur = (selectedService?.duration_minutes ?? 30) + (selectedService?.buffer_minutes ?? 0)
      const stillAvailable = await getAvailableSlots(barberId, date, slotDur)
      if (!stillAvailable.includes(time)) {
        setError('Este horário não está mais disponível. Escolha outro.')
        setSaving(false)
        return
      }

      let clientId = ''
      const { data: existing } = await supabase.from('clients').select('id').eq('shop_id', shop.id).eq('phone', cleanPhone).maybeSingle()
      if (existing) {
        clientId = existing.id as string
      } else {
        const { data: newClient } = await supabase.from('clients').insert({ shop_id: shop.id, name: name.trim(), phone: cleanPhone }).select('id').single()
        if (!newClient) throw new Error('Erro ao criar cliente')
        clientId = newClient.id as string
      }

      const startTime = buildISO(date, time)
      const endTime = new Date(startTime.getTime() + (selectedService?.duration_minutes ?? 30) * 60000)

      await supabase.from('appointments').insert({
        shop_id: shop.id,
        barber_id: barberId,
        service_id: serviceId,
        client_id: clientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'pending',
        price_at_booking: selectedService?.price ?? null,
      })

      const msg = [
        `🪒 *AppBarber*`,
        ``,
        `Olá ${name.trim()}, seu agendamento foi confirmado!`,
        ``,
        `📅 ${date} às ${time}`,
        `💈 ${selectedService?.name ?? 'Serviço'}`,
        `✂️ ${selectedBarber?.name ?? 'Barbeiro'}`,
      ].join('\n')

      const sent = await sendText({ number: cleanPhone, text: msg, shopId: shop.id })
      if (sent) toast.success('Confirmação enviada via WhatsApp')
      else toast.warning('Agendamento criado, mas WhatsApp não configurado')

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao agendar')
    } finally {
      setSaving(false)
    }
  }

  function getPeriod(slot: string) {
    const h = parseInt(slot.split(':')[0], 10)
    if (h < 12) return 'manha'
    if (h < 18) return 'tarde'
    return 'noite'
  }

  const manhaSlots = availableSlots.filter((s) => getPeriod(s) === 'manha')
  const tardeSlots = availableSlots.filter((s) => getPeriod(s) === 'tarde')
  const noiteSlots = availableSlots.filter((s) => getPeriod(s) === 'noite')

  const todayStr = getUTC3DateKey()

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-4">
        <Card className="animate-scale-in w-full max-w-md border-indigo-500/30 bg-white/95 shadow-2xl shadow-indigo-500/20 backdrop-blur dark:bg-gray-950/95">
          <CardContent className="pt-10 pb-8 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
              <CheckCircle className="size-8 text-white" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Agendamento confirmado</h2>
            <p className="mb-3 text-muted-foreground">
              Você receberá a confirmação no WhatsApp e o lembrete antes do horário.
            </p>
            <div className="mx-auto mb-6 max-w-xs rounded-xl border border-indigo-500/10 bg-indigo-500/10 p-4 text-left text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold text-indigo-600 dark:text-indigo-400">
                <BadgeCheck className="size-4" /> Resumo
              </p>
              <div className="space-y-1 text-muted-foreground">
                <p>{selectedBarber?.name}</p>
                <p>{selectedService?.name}</p>
                <p>{date} às {time}</p>
              </div>
            </div>
            <Button onClick={reset} className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
              Novo agendamento
            </Button>
          </CardContent>
        </Card>
        <Toaster richColors />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/15 via-transparent to-transparent" />
      <Card className="animate-scale-in relative w-full max-w-3xl border-indigo-500/20 bg-white/95 shadow-2xl shadow-indigo-500/10 backdrop-blur dark:bg-gray-950/95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
            <Scissors className="size-7 text-white" />
          </div>
          <CardTitle className="text-xl">Agendar horário</CardTitle>
          <p className="text-sm text-muted-foreground">Escolha barbeiro, serviço, data e horário disponível</p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  step === s
                    ? 'bg-indigo-600 text-white shadow-md'
                    : step > s
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 3 && <div className={`h-0.5 w-6 transition-colors duration-300 ${step > s ? 'bg-green-500' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <form onSubmit={handleSubmit} className="space-y-4">
                {step === 1 && (
                  <div className="animate-fade-in-up space-y-4">
                    <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                      <p className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        <Info className="size-4" /> Primeiro, escolha quem vai atender e qual serviço deseja.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Scissors className="size-4 text-indigo-500" /> Barbeiro
                      </label>
                      <Select value={barberId} onValueChange={(v) => v && setBarberId(v)}>
                        <SelectTrigger className="border-indigo-500/20 focus:ring-indigo-500"><SelectValue placeholder="Selecione o barbeiro" /></SelectTrigger>
                        <SelectContent>
                          {barbers.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="size-4 text-indigo-500" /> Serviço
                      </label>
                      <Select value={serviceId} onValueChange={(v) => v && setServiceId(v)}>
                        <SelectTrigger className="border-indigo-500/20 focus:ring-indigo-500"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                        <SelectContent>
                          {services.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} — R$ {Number(s.price).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedService && (
                        <p className="text-xs text-muted-foreground">⏱ {selectedService.duration_minutes} min</p>
                      )}
                    </div>
                    <Button type="button" onClick={nextStep} disabled={!canProceed(1)} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                      Próximo
                    </Button>
                  </div>
                )}

                {step === 2 && (
                  <div className="animate-fade-in-up space-y-4">
                    <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        Agora escolha a data e depois um horário realmente livre.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <CalendarDays className="size-4 text-indigo-500" /> Data
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={todayStr}
                        className="flex h-10 w-full rounded-lg border border-indigo-500/20 bg-transparent px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:inherit]"
                      />
                    </div>
                    {date && (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="size-4 text-indigo-500" /> Horário disponível
                        </label>
                        {loadingSlots ? (
                          <div className="flex items-center gap-2 rounded-lg border border-indigo-500/10 bg-indigo-500/5 px-3 py-3 text-sm text-muted-foreground">
                            <div className="size-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                            Verificando horários...
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400">
                            Nenhum horário disponível nesta data. Tente outro dia.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {manhaSlots.length > 0 && (
                              <div>
                                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Sun className="size-3" /> Manhã
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {manhaSlots.map((slot) => (
                                    <button
                                      type="button"
                                      key={slot}
                                      onClick={() => setTime(slot)}
                                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                                        time === slot
                                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                          : 'border-indigo-500/20 text-foreground hover:border-indigo-500/50 hover:bg-indigo-500/10'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {tardeSlots.length > 0 && (
                              <div>
                                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Sun className="size-3" /> Tarde
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {tardeSlots.map((slot) => (
                                    <button
                                      type="button"
                                      key={slot}
                                      onClick={() => setTime(slot)}
                                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                                        time === slot
                                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                          : 'border-indigo-500/20 text-foreground hover:border-indigo-500/50 hover:bg-indigo-500/10'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {noiteSlots.length > 0 && (
                              <div>
                                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Moon className="size-3" /> Noite
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {noiteSlots.map((slot) => (
                                    <button
                                      type="button"
                                      key={slot}
                                      onClick={() => setTime(slot)}
                                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                                        time === slot
                                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                          : 'border-indigo-500/20 text-foreground hover:border-indigo-500/50 hover:bg-indigo-500/10'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1 text-muted-foreground hover:text-indigo-600">
                        <ChevronLeft className="mr-1 size-4" /> Voltar
                      </Button>
                      <Button type="button" onClick={nextStep} disabled={!canProceed(2)} className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="animate-fade-in-up space-y-4">
                    <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        Confirme seus dados para finalizar.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <User className="size-4 text-indigo-500" /> Nome
                      </label>
                      <input
                        placeholder="Seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-indigo-500/20 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Phone className="size-4 text-indigo-500" /> WhatsApp
                      </label>
                      <input
                        placeholder="(11) 99999-8888"
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                        inputMode="numeric"
                        className="flex h-10 w-full rounded-lg border border-indigo-500/20 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-muted-foreground">Usado para confirmar e lembrar o agendamento.</p>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => setStep(2)} className="flex-1 text-muted-foreground hover:text-indigo-600">
                        <ChevronLeft className="mr-1 size-4" /> Voltar
                      </Button>
                      <Button type="submit" disabled={saving || !canProceed(3)} className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md hover:from-indigo-500 hover:to-blue-500">
                        {saving ? (
                          <><div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Agendando...</>
                        ) : (
                          <><CheckCircle className="mr-2 size-4" /> Confirmar</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </form>

              <aside className="h-fit rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
                    <BadgeCheck className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Resumo do agendamento</h3>
                    <p className="text-xs text-muted-foreground">Sempre visível para dar contexto</p>
                  </div>
                </div>
                <div className="space-y-3 rounded-xl border border-white/10 bg-card p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Barbeiro</p>
                    <p className="font-medium">{bookingSummary.barberName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Serviço</p>
                    <p className="font-medium">{bookingSummary.serviceName}</p>
                    <p className="text-sm text-muted-foreground">{bookingSummary.duration ? `${bookingSummary.duration} min` : 'Duração pendente'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
                      <p className="font-medium">{bookingSummary.dateLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Horário</p>
                      <p className="font-medium">{bookingSummary.timeLabel}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">WhatsApp</p>
                    <p className="font-medium">{bookingSummary.phoneLabel}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-500/10 bg-indigo-500/10 p-3 text-xs text-muted-foreground">
                    Todos os horários são mostrados em UTC-3.
                  </div>
                </div>
              </aside>
            </div>
          )}
        </CardContent>
      </Card>
      <Toaster richColors />
    </div>
  )
}

export default Booking
