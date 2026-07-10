import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PageTransition from '@/components/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart3, TrendingUp, DollarSign, Scissors, Users, Calendar, XCircle, Sparkles } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { getUTC3DateParts, getUTC3MonthKey, startOfUTC3MonthISO } from '@/lib/timezone'

interface BarberStats {
  name: string
  total: number
  completed: number
  cancelled: number
  revenue: number
}

interface MonthlyStats {
  key: string
  label: string
  total: number
  revenue: number
}

const PERIOD_LABELS: Record<string, string> = {
  month: 'Este mês',
  '3months': 'Últimos 3 meses',
  year: 'Este ano',
}

function Reports() {
  const { shop, loading: shopLoading } = useAuth()
  const [barberStats, setBarberStats] = useState<BarberStats[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ total: 0, completed: 0, cancelled: 0, revenue: 0, avgTicket: 0 })

  const currency = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  useEffect(() => {
    load()
  }, [period, shop?.id, shopLoading])

  async function load() {
    setLoading(true)
    try {
      if (shopLoading) return
      if (!shop) {
        setBarberStats([])
        setMonthlyStats([])
        setSummary({ total: 0, completed: 0, cancelled: 0, revenue: 0, avgTicket: 0 })
        return
      }
      const now = new Date()
      const { month } = getUTC3DateParts(now)
      const startDateIso =
        period === 'month'
          ? startOfUTC3MonthISO(now, 0)
          : period === '3months'
            ? startOfUTC3MonthISO(now, 2)
            : startOfUTC3MonthISO(now, month - 1)

      const [barbersRes, aptsRes, servicesRes] = await Promise.all([
        supabase.from('barbers').select('id, name').eq('shop_id', shop.id).order('name'),
        supabase.from('appointments').select('*')
          .eq('shop_id', shop.id)
          .gte('start_time', startDateIso)
          .lte('start_time', now.toISOString())
          .neq('status', 'pending'),
        supabase.from('services').select('id, name, price').eq('shop_id', shop.id),
      ])

      const barbers = (barbersRes.data ?? []) as { id: string; name: string }[]
      const apts = (aptsRes.data ?? []) as Array<{ id: string; barber_id: string; service_id: string; start_time: string; status: string; price_at_booking: number | null }>
      const services = (servicesRes.data ?? []) as { id: string; name: string; price: number }[]

      const servicePriceMap = new Map(services.map((s) => [s.id, s.price]))
      const completedApts = apts.filter((a) => a.status === 'completed')
      const cancelledApts = apts.filter((a) => a.status === 'cancelled')
      const totalRevenue = completedApts.reduce((sum, a) => sum + (a.price_at_booking ?? servicePriceMap.get(a.service_id) ?? 0), 0)

      setSummary({
        total: apts.length,
        completed: completedApts.length,
        cancelled: cancelledApts.length,
        revenue: totalRevenue,
        avgTicket: completedApts.length > 0 ? Math.round(totalRevenue / completedApts.length) : 0,
      })

      const stats: BarberStats[] = barbers.map((b) => {
        const barberApts = apts.filter((a) => a.barber_id === b.id)
        const completed = barberApts.filter((a) => a.status === 'completed')
        const cancelled = barberApts.filter((a) => a.status === 'cancelled')
        const revenue = completed.reduce((sum, a) => sum + (a.price_at_booking ?? servicePriceMap.get(a.service_id) ?? 0), 0)
        return {
          name: b.name,
          total: barberApts.length,
          completed: completed.length,
          cancelled: cancelled.length,
          revenue,
        }
      })
      setBarberStats(stats)

      const monthMap = new Map<string, { total: number; revenue: number }>()
      for (const a of apts) {
        const m = getUTC3MonthKey(a.start_time)
        const entry = monthMap.get(m) ?? { total: 0, revenue: 0 }
        entry.total++
        if (a.status === 'completed') {
          entry.revenue += a.price_at_booking ?? servicePriceMap.get(a.service_id) ?? 0
        }
        monthMap.set(m, entry)
      }

      const months: MonthlyStats[] = Array.from(monthMap.entries())
        .map(([key, val]) => {
          const label = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            month: 'short',
            year: '2-digit',
          }).format(new Date(`${key}-01T12:00:00-03:00`))
          return { key, label, total: val.total, revenue: val.revenue }
        })
        .sort((a, b) => a.key.localeCompare(b.key))

      setMonthlyStats(months)
    } finally {
      setLoading(false)
    }
  }

  const maxRevenue = Math.max(...monthlyStats.map((m) => m.revenue), 1)
  const periodLabel = PERIOD_LABELS[period] ?? 'Período'

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Relatórios</h1>
              <p className="text-sm text-muted-foreground">Visão de desempenho e faturamento da barbearia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 sm:inline-flex">
              {periodLabel}
            </span>
            <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
              <SelectTrigger className="w-40 border-indigo-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="3months">Últimos 3 meses</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-indigo-500/10 bg-card/70" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-80 animate-pulse rounded-2xl border border-indigo-500/10 bg-card/70" />
              <div className="h-80 animate-pulse rounded-2xl border border-indigo-500/10 bg-card/70" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="border-indigo-500/10">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Agendamentos</p>
                    <p className="text-2xl font-bold">{summary.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-500/10">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Concluídos</p>
                    <p className="text-2xl font-bold">{summary.completed}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-rose-500/10">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md">
                    <XCircle className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cancelados</p>
                    <p className="text-2xl font-bold">{summary.cancelled}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-500/10">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                    <DollarSign className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                    <p className="text-2xl font-bold">{currency.format(summary.revenue)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-violet-500/10">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                    <Scissors className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ticket médio</p>
                    <p className="text-2xl font-bold">{currency.format(summary.avgTicket)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-indigo-500/10">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-indigo-500" />
                    <CardTitle className="text-base">Por barbeiro</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {barberStats.map((b) => {
                      const pct = summary.total > 0 ? Math.round((b.total / summary.total) * 100) : 0
                      return (
                        <div key={b.name} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div>
                              <p className="font-medium">{b.name}</p>
                              <p className="text-xs text-muted-foreground">{b.completed} concluídos · {b.cancelled} cancelados</p>
                            </div>
                            <span className="text-muted-foreground">{b.total} agend. · {currency.format(b.revenue)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-indigo-500/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-500/10">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-indigo-500" />
                    <CardTitle className="text-base">Faturamento mensal</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {monthlyStats.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-muted-foreground">
                      Sem dados suficientes para montar o gráfico.
                    </div>
                  ) : (
                    <div className="flex items-end gap-3" style={{ height: '180px' }}>
                      {monthlyStats.map((m) => {
                        const height = Math.max((m.revenue / maxRevenue) * 100, m.revenue > 0 ? 8 : 2)
                        return (
                          <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                            <span className="text-[10px] font-medium text-muted-foreground">{currency.format(m.revenue)}</span>
                            <div className="w-full rounded-md bg-gradient-to-t from-indigo-500 to-blue-600 transition-all duration-500" style={{ height: `${height}%` }} />
                            <span className="text-[10px] text-muted-foreground">{m.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-indigo-500/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-indigo-500" />
                  <CardTitle className="text-base">Leitura rápida</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Taxa de conclusão</p>
                  <p className="mt-1 text-2xl font-bold">
                    {summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}%
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancelamentos</p>
                  <p className="mt-1 text-2xl font-bold">
                    {summary.total > 0 ? Math.round((summary.cancelled / summary.total) * 100) : 0}%
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Faturamento médio</p>
                  <p className="mt-1 text-2xl font-bold">
                    {currency.format(summary.avgTicket)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default Reports
