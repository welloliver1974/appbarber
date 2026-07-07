import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { StatsCardSkeleton } from '@/components/Skeleton'
import PageTransition from '@/components/PageTransition'
import { Scissors, Users, Calendar, Clock } from 'lucide-react'

interface DashboardCounts {
  barbers: number
  services: number
  todayAppointments: number
  totalAppointments: number
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
    label: 'Barbeiros',
    icon: Users,
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/20',
    bgLight: '',
    delay: 0,
  },
  {
    label: 'Serviços',
    icon: Scissors,
    gradient: 'from-violet-500 to-purple-600',
    glow: '',
    bgLight: '',
    delay: 100,
  },
  {
    label: 'Agendamentos Hoje',
    icon: Calendar,
    gradient: 'from-emerald-500 to-teal-600',
    glow: '',
    bgLight: '',
    delay: 200,
  },
  {
    label: 'Total Agendamentos',
    icon: Clock,
    gradient: 'from-orange-500 to-amber-600',
    glow: '',
    bgLight: '',
    delay: 300,
  },
]

function Dashboard() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null)

  useEffect(() => {
    async function load() {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const [barbers, services, appointments] = await Promise.all([
        supabase.from('barbers').select('*', { count: 'exact', head: true }),
        supabase.from('services').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
      ])

      const { count: todayCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .eq('status', 'confirmed')

      setCounts({
        barbers: barbers.count ?? 0,
        services: services.count ?? 0,
        todayAppointments: todayCount ?? 0,
        totalAppointments: appointments.count ?? 0,
      })
    }
    load()
  }, [])

  return (
    <PageTransition>
      <div className="p-4 sm:p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da barbearia</p>
        </div>

        {!counts ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => {
              const Icon = card.icon
              const value = counts[['barbers', 'services', 'todayAppointments', 'totalAppointments'][i] as keyof DashboardCounts]
              return (
                <div
                  key={card.label}
                  className="group animate-fade-in-up relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  style={{ animationDelay: `${card.delay}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-[0.03] dark:opacity-[0.05] transition-opacity duration-300 group-hover:opacity-[0.06]`} />
                  <div className="relative">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                      <div className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                        <Icon className="size-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-bold tracking-tight">
                      <AnimatedCounter value={value} duration={1400} />
                    </p>
                    <div className={`mt-3 h-1 w-12 rounded-full bg-gradient-to-r ${card.gradient} transition-all duration-300 group-hover:w-20`} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default Dashboard
