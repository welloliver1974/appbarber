import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StatsCardSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageTransition from '@/components/PageTransition'
import {
  addUTC3Days,
  endOfUTC3DayISO,
  formatDateTime,
  formatTime,
  getUTC3DateKey,
  getUTC3TimeParts,
  getUTC3WeekStart,
  startOfUTC3DayISO,
} from '@/lib/timezone'
import { AlertCircle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, TrendingUp, Users, Scissors, XCircle } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import type { Barber } from '@/types/database'

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

interface DashboardCounts {
  barbers: number
  services: number
  todayAppointments: number
  totalAppointments: number
}

interface ScheduleAppt {
  id: string
  barber_id: string
  barber_name: string
  client_name: string
  service_name: string
  start_time: string
  end_time: string
  status: string
}

interface AppointmentRow {
  id: string
  barber_id: string
  client_id: string
  service_id: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
}

interface UpcomingAppointment {
  id: string
  barber_name: string
  client_name: string
  service_name: string
  start_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
}

interface BarberLoad {
  id: string
  name: string
  total: number
  nextStart: string | null
}

interface OperationalMetrics {
  nextTwoHours: number
  pendingToday: number
  completedToday: number
  cancelledToday: number
}

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    ref.current = requestAnimationFrame(function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.floor(eased * value))
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    })
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [value, duration])

  return <>{display}</>
}

const cards = [
  {
    label: 'Barbeiros', icon: Users, from: 'from-indigo-500', to: 'to-blue-600',
    border: 'border-indigo-500/20', shadow: 'shadow-indigo-500/10', delay: 0,
  },
  {
    label: 'Serviços', icon: Scissors, from: 'from-violet-500', to: 'to-indigo-600',
    border: 'border-violet-500/20', shadow: 'shadow-violet-500/10', delay: 100,
  },
  {
    label: 'Agendamentos Hoje', icon: Calendar, from: 'from-sky-500', to: 'to-indigo-500',
    border: 'border-sky-500/20', shadow: 'shadow-sky-500/10', delay: 200,
  },
  {
    label: 'Total Agendamentos', icon: Clock, from: 'from-indigo-500', to: 'to-purple-600',
    border: 'border-indigo-500/20', shadow: 'shadow-indigo-500/10', delay: 300,
  },
]

const statusColors: Record<string, string> = {
  pending: 'border-l-amber-500 bg-amber-500/10',
  confirmed: 'border-l-indigo-500 bg-indigo-500/10',
  completed: 'border-l-green-500 bg-green-500/10',
  cancelled: 'border-l-red-500 bg-red-500/10 opacity-50',
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8)

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

function getWeekDays(date: Date) {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    days.push(addUTC3Days(date, i))
  }
  return days
}

function formatDateISO(d: Date) {
  return getUTC3DateKey(d)
}

function formatDateBR(d: Date) {
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const wd = WEEKDAY_LABELS[d.getDay()]
  return `${wd}, ${day}/${month}`
}

function Dashboard() {
  const { shop, loading: shopLoading } = useAuth()
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [metrics, setMetrics] = useState<OperationalMetrics>({
    nextTwoHours: 0,
    pendingToday: 0,
    completedToday: 0,
    cancelledToday: 0,
  })
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([])
  const [barberLoad, setBarberLoad] = useState<BarberLoad[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [schedule, setSchedule] = useState<ScheduleAppt[]>([])
  const [selectedBarber, setSelectedBarber] = useState('')
  const [weekStart, setWeekStart] = useState(() => getUTC3WeekStart())

  const weekDays = getWeekDays(weekStart)

  useEffect(() => {
    if (shopLoading) return
    if (!shop) {
      setCounts({
        barbers: 0,
        services: 0,
        todayAppointments: 0,
        totalAppointments: 0,
      })
      setMetrics({
        nextTwoHours: 0,
        pendingToday: 0,
        completedToday: 0,
        cancelledToday: 0,
      })
      setUpcomingAppointments([])
      setBarberLoad([])
      setBarbers([])
      return
    }

    async function load() {
      const activeShop = shop
      if (!activeShop) return

      try {
        const now = new Date()
        const todayKey = getUTC3DateKey(now)
        const todayStart = startOfUTC3DayISO(todayKey)
        const todayEnd = endOfUTC3DayISO(todayKey)
        const nextTwoHours = new Date(now)
        nextTwoHours.setHours(nextTwoHours.getHours() + 2)

        const [barbersCountRes, servicesCountRes, appointmentsCountRes, barbersListRes, todayAppointmentsRes, upcomingRes] = await Promise.all([
          supabase.from('barbers').select('*', { count: 'exact', head: true }).eq('shop_id', activeShop.id),
          supabase.from('services').select('*', { count: 'exact', head: true }).eq('shop_id', activeShop.id),
          supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('shop_id', activeShop.id),
          supabase.from('barbers').select('*').eq('shop_id', activeShop.id).order('name'),
          supabase
            .from('appointments')
            .select('id, barber_id, client_id, service_id, start_time, end_time, status')
            .eq('shop_id', activeShop.id)
            .gte('start_time', todayStart)
            .lte('start_time', todayEnd)
            .order('start_time'),
          supabase
            .from('appointments')
            .select('id, barber_id, client_id, service_id, start_time, end_time, status')
            .eq('shop_id', activeShop.id)
            .gte('start_time', now.toISOString())
            .lte('start_time', nextTwoHours.toISOString())
            .neq('status', 'cancelled')
            .order('start_time')
            .limit(5),
        ])

        if (barbersListRes.error) throw barbersListRes.error
        if (todayAppointmentsRes.error) throw todayAppointmentsRes.error
        if (upcomingRes.error) throw upcomingRes.error

        const rawToday = (todayAppointmentsRes.data ?? []) as AppointmentRow[]
        const rawUpcoming = (upcomingRes.data ?? []) as AppointmentRow[]
        const rawRelevant = [...rawToday, ...rawUpcoming]

        const barberIds = [...new Set(rawRelevant.map((a) => a.barber_id))]
        const clientIds = [...new Set(rawRelevant.map((a) => a.client_id))]
        const serviceIds = [...new Set(rawRelevant.map((a) => a.service_id))]

        const [barbersRes, clientsRes, servicesRes] = await Promise.all([
          barberIds.length ? supabase.from('barbers').select('id, name').in('id', barberIds) : Promise.resolve({ data: [] }),
          clientIds.length ? supabase.from('clients').select('id, name').eq('shop_id', activeShop.id).in('id', clientIds) : Promise.resolve({ data: [] }),
          serviceIds.length ? supabase.from('services').select('id, name').in('id', serviceIds) : Promise.resolve({ data: [] }),
        ])

        const barberMap = new Map((barbersRes.data ?? []).map((b: { id: string; name: string }) => [b.id, b.name]))
        const clientMap = new Map((clientsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
        const serviceMap = new Map((servicesRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))

        setCounts({
          barbers: barbersCountRes.count ?? 0,
          services: servicesCountRes.count ?? 0,
          todayAppointments: rawToday.length,
          totalAppointments: appointmentsCountRes.count ?? 0,
        })

        setBarbers((barbersListRes.data ?? []) as Barber[])

        const pendingToday = rawToday.filter((a) => a.status === 'pending').length
        const completedToday = rawToday.filter((a) => a.status === 'completed').length
        const cancelledToday = rawToday.filter((a) => a.status === 'cancelled').length
        const nextTwoHoursCount = rawUpcoming.length

        setMetrics({
          nextTwoHours: nextTwoHoursCount,
          pendingToday,
          completedToday,
          cancelledToday,
        })

        setUpcomingAppointments(
          rawUpcoming.map((a) => ({
            id: a.id,
            barber_name: barberMap.get(a.barber_id) ?? 'Desconhecido',
            client_name: clientMap.get(a.client_id) ?? 'Desconhecido',
            service_name: serviceMap.get(a.service_id) ?? 'Desconhecido',
            start_time: a.start_time,
            status: a.status,
          })),
        )

        const todayActive = rawToday.filter((a) => a.status !== 'cancelled')
        const futureToday = todayActive.filter((a) => new Date(a.start_time).getTime() >= now.getTime())
        const load = (barbersListRes.data ?? []).map((barber: { id: string; name: string }) => {
          const barberAppointments = todayActive.filter((a) => a.barber_id === barber.id)
          const nextStart = futureToday
            .filter((a) => a.barber_id === barber.id)
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]?.start_time ?? null

          return {
            id: barber.id,
            name: barber.name,
            total: barberAppointments.length,
            nextStart,
          }
        }).sort((a, b) => b.total - a.total)

        setBarberLoad(load)
      } catch (err) {
        console.error(err)
      }
    }

    load()
  }, [shop?.id, shopLoading])

  useEffect(() => {
    if (shopLoading) return
    if (!shop) {
      setSchedule([])
      return
    }

    async function loadSchedule() {
      const activeShop = shop
      if (!activeShop) {
        setSchedule([])
        return
      }

      const weekStartKey = formatDateISO(weekDays[0])
      const weekEndKey = formatDateISO(weekDays[6])

      let query = supabase
        .from('appointments')
        .select('*')
        .eq('shop_id', activeShop.id)
        .gte('start_time', startOfUTC3DayISO(weekStartKey))
        .lte('start_time', endOfUTC3DayISO(weekEndKey))
        .neq('status', 'cancelled')
        .order('start_time')

      const { data: apts } = await query
      const raw = (apts ?? []) as Array<{ id: string; barber_id: string; client_id: string; service_id: string; start_time: string; end_time: string; status: string }>

      if (raw.length === 0) {
        setSchedule([])
        return
      }

      const barberIds = [...new Set(raw.map((a) => a.barber_id))]
      const clientIds = [...new Set(raw.map((a) => a.client_id))]
      const serviceIds = [...new Set(raw.map((a) => a.service_id))]

      const [barbersR, clientsR, servicesR] = await Promise.all([
        supabase.from('barbers').select('id, name').eq('shop_id', activeShop.id).in('id', barberIds),
        supabase.from('clients').select('id, name').eq('shop_id', activeShop.id).in('id', clientIds),
        supabase.from('services').select('id, name').eq('shop_id', activeShop.id).in('id', serviceIds),
      ])

      const bMap = new Map((barbersR.data ?? []).map((b: { id: string; name: string }) => [b.id, b.name]))
      const cMap = new Map((clientsR.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
      const sMap = new Map((servicesR.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))

      setSchedule(raw.map((a) => ({
        id: a.id,
        barber_id: a.barber_id,
        barber_name: bMap.get(a.barber_id) ?? '?',
        client_name: cMap.get(a.client_id) ?? '?',
        service_name: sMap.get(a.service_id) ?? '?',
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
      })))
    }

    loadSchedule()
  }, [weekStart, shop?.id, shopLoading])

  const filtered = !selectedBarber
    ? schedule
    : schedule.filter((a) => a.barber_id === selectedBarber)

  function getApptsForDay(day: Date) {
    const dayStr = formatDateISO(day)
    return filtered.filter((a) => formatDateISO(new Date(a.start_time)) === dayStr)
  }

  function getApptPosition(appt: ScheduleAppt) {
    const start = getUTC3TimeParts(appt.start_time)
    const end = getUTC3TimeParts(appt.end_time)
    const startMin = start.hour * 60 + start.minute
    const endMin = end.hour * 60 + end.minute
    const top = ((startMin - 480) / 720) * 100
    const height = Math.max(((endMin - startMin) / 720) * 100, 4)
    return { top: `${top}%`, height: `${height}%` }
  }

  const maxLoad = Math.max(...barberLoad.map((item) => item.total), 1)

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Painel operacional da barbearia</p>
            </div>
          </div>
        </div>

        {!counts ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => {
              const Icon = card.icon
              const value = counts[['barbers', 'services', 'todayAppointments', 'totalAppointments'][i] as keyof DashboardCounts]
              return (
                <div
                  key={card.label}
                  className={`group animate-fade-in-up relative overflow-hidden rounded-2xl border bg-card p-6 shadow-lg ${card.shadow} ${card.border} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl`}
                  style={{ animationDelay: `${card.delay}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.from} ${card.to} opacity-[0.04] transition-opacity duration-300 group-hover:opacity-[0.08]`} />
                  <div className="relative">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                      <div className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.from} ${card.to} text-white shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg`}>
                        <Icon className="size-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-bold tracking-tight">
                      <AnimatedCounter value={value} duration={1400} />
                    </p>
                    <div className={`mt-3 h-1 w-12 rounded-full bg-gradient-to-r ${card.from} ${card.to} transition-all duration-300 group-hover:w-full`} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                label: 'Próximas 2h',
                value: metrics.nextTwoHours,
                description: 'Atendimentos chegando agora',
                icon: Clock,
                from: 'from-indigo-500',
                to: 'to-blue-600',
                border: 'border-indigo-500/20',
              },
              {
                label: 'Pendentes hoje',
                value: metrics.pendingToday,
                description: 'Precisam de confirmação',
                icon: AlertCircle,
                from: 'from-amber-500',
                to: 'to-orange-600',
                border: 'border-amber-500/20',
              },
              {
                label: 'Concluídos hoje',
                value: metrics.completedToday,
                description: 'Finalizados até agora',
                icon: CheckCircle2,
                from: 'from-emerald-500',
                to: 'to-green-600',
                border: 'border-emerald-500/20',
              },
              {
                label: 'Cancelados hoje',
                value: metrics.cancelledToday,
                description: 'Ocorrências a observar',
                icon: XCircle,
                from: 'from-rose-500',
                to: 'to-red-600',
                border: 'border-rose-500/20',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className={`relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${item.border}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.from} ${item.to} opacity-[0.04]`} />
                  <div className="relative">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                      <div className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.from} ${item.to} text-white shadow-md`}>
                        <Icon className="size-4" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tracking-tight">
                      <AnimatedCounter value={item.value} duration={1200} />
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl border border-indigo-500/10 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
                  <Clock className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Próximos atendimentos</h2>
                  <p className="text-xs text-muted-foreground">Janela de foco operacional</p>
                </div>
              </div>
              <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {metrics.nextTwoHours} agora
              </span>
            </div>

            {upcomingAppointments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-muted-foreground">
                Nenhum atendimento nas próximas 2 horas.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="rounded-xl border border-indigo-500/10 bg-background/80 p-3 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{appt.client_name}</p>
                          <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusColors[appt.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {statusLabels[appt.status] ?? appt.status}
                          </span>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {appt.barber_name} · {appt.service_name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(appt.start_time)}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatTime(appt.start_time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-indigo-500/10 bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
              <Users className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Carga por barbeiro</h2>
              <p className="text-xs text-muted-foreground">Volume de hoje e próximo horário livre</p>
            </div>
          </div>

          {barberLoad.length === 0 ? (
            <div className="rounded-xl border border-dashed border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-muted-foreground">
              Nenhum dado de carga disponível.
            </div>
          ) : (
            <div className="space-y-4">
              {barberLoad.map((item) => {
                const progress = Math.max((item.total / maxLoad) * 100, 6)
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.nextStart ? `Próximo às ${formatTime(item.nextStart)}` : 'Sem atendimentos nas próximas 2h'}
                        </p>
                      </div>
                      <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        {item.total} hoje
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-indigo-500/10">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
                <Calendar className="size-4" />
              </div>
              <h2 className="text-lg font-bold">Agenda Semanal</h2>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedBarber} onValueChange={(v) => setSelectedBarber(v ?? '')}>
                <SelectTrigger className="w-36 border-indigo-500/20 sm:w-44"><SelectValue placeholder="Todos os barbeiros" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os barbeiros</SelectItem>
                  {barbers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart((current) => addUTC3Days(current, -7))} className="text-muted-foreground hover:text-indigo-600">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart((current) => addUTC3Days(current, 7))} className="text-muted-foreground hover:text-indigo-600">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-indigo-500/10 bg-card shadow-sm">
            <div className="flex" style={{ minWidth: '700px' }}>
              <div className="w-14 shrink-0 border-r border-indigo-500/10">
                <div className="h-10 border-b border-indigo-500/10" />
                {HOURS.map((h) => (
                  <div key={h} className="flex h-[60px] items-end justify-center pb-1 text-[11px] text-muted-foreground">
                    {formatHour(h)}
                  </div>
                ))}
              </div>
              {weekDays.map((day) => {
                const dayStr = formatDateISO(day)
                const todayStr = formatDateISO(new Date())
                const isToday = dayStr === todayStr
                const appts = getApptsForDay(day)
                return (
                  <div key={dayStr} className={`relative min-w-0 flex-1 border-r border-indigo-500/10 last:border-r-0 ${isToday ? 'bg-indigo-500/5' : ''}`}>
                    <div className={`border-b border-indigo-500/10 p-2 text-center text-xs font-medium ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`}>
                      <span className="hidden sm:inline">{formatDateBR(day)}</span>
                      <span className="sm:hidden">
                        {WEEKDAY_LABELS[day.getDay()]}
                      </span>
                    </div>
                    <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
                      {HOURS.map((h) => (
                        <div key={h} className="absolute left-0 right-0 border-t border-indigo-500/5" style={{ top: `${((h - 8) / 12) * 100}%` }} />
                      ))}
                      {appts.map((appt) => {
                        const pos = getApptPosition(appt)
                        return (
                          <div
                            key={appt.id}
                            className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-xs transition-all hover:z-10 hover:shadow-md ${statusColors[appt.status] ?? 'border-l-gray-400 bg-gray-500/10'}`}
                            style={{ top: pos.top, height: pos.height }}
                          >
                            <p className="truncate font-medium leading-tight">{appt.client_name}</p>
                            <p className="truncate leading-tight text-muted-foreground">{appt.service_name}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

export default Dashboard
