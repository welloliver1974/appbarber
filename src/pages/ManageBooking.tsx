import { useEffect, useState } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Scissors, Clock, AlertTriangle, Loader2, Calendar } from 'lucide-react'

/** Quantas horas antes do horário o cliente pode cancelar */
const CANCEL_WINDOW_HOURS = 2

interface AppointmentInfo {
  id: string
  start_time: string
  status: string
  barber_name: string
  service_name: string
  client_name: string
  shop_name: string
}

type PageState = 'loading' | 'ready' | 'too-late' | 'already-cancelled' | 'cancelled' | 'error' | 'not-found'

export default function ManageBooking() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [pageState, setPageState] = useState<PageState>('loading')
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setPageState('error')
      setErrorMsg('Link inválido. Token não encontrado.')
      return
    }
    load()
  }, [token])

  async function load() {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          status,
          barbers ( name ),
          services ( name ),
          clients ( name ),
          shops ( name )
        `)
        .eq('cancel_token', token)
        .maybeSingle()

      if (error || !data) {
        setPageState('not-found')
        return
      }

      const info: AppointmentInfo = {
        id: data.id,
        start_time: data.start_time,
        status: data.status,
        barber_name: (data.barbers as unknown as { name: string } | null)?.name ?? 'Barbeiro',
        service_name: (data.services as unknown as { name: string } | null)?.name ?? 'Serviço',
        client_name: (data.clients as unknown as { name: string } | null)?.name ?? 'Cliente',
        shop_name: (data.shops as unknown as { name: string } | null)?.name ?? 'Barbearia',
      }

      setAppointment(info)

      if (info.status === 'cancelled') {
        setPageState('already-cancelled')
        return
      }

      if (info.status === 'completed') {
        setPageState('error')
        setErrorMsg('Este atendimento já foi concluído e não pode ser cancelado.')
        return
      }

      // Verifica janela de cancelamento
      const start = new Date(info.start_time)
      const now = new Date()
      const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (diffHours < CANCEL_WINDOW_HOURS) {
        setPageState('too-late')
        return
      }

      setPageState('ready')
    } catch {
      setPageState('error')
      setErrorMsg('Não foi possível carregar as informações do agendamento.')
    }
  }

  async function handleCancel() {
    if (!appointment) return
    setCancelling(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id)

      if (error) throw error
      setPageState('cancelled')
    } catch {
      setErrorMsg('Erro ao cancelar. Tente novamente ou entre em contato.')
      setPageState('error')
    } finally {
      setCancelling(false)
    }
  }

  const formattedDate = appointment
    ? new Date(appointment.start_time).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
    : ''

  const formattedTime = appointment
    ? new Date(appointment.start_time).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  const shopSlug = slug ?? ''
  const bookingUrl = shopSlug ? `/public/${shopSlug}` : '/'

  return (
    <div
      style={{ background: '#050505' }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      {/* Glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(217,119,6,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg shadow-amber-500/20">
            <Scissors className="size-7 text-black" />
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-amber-500/70 font-medium">
            {appointment?.shop_name ?? 'AppBarber'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm shadow-2xl">

          {/* LOADING */}
          {pageState === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8 text-neutral-400">
              <Loader2 className="size-8 animate-spin text-amber-500" />
              <p className="text-sm">Carregando agendamento…</p>
            </div>
          )}

          {/* READY — mostrar detalhes e botão cancelar */}
          {pageState === 'ready' && appointment && (
            <>
              <h1 className="mb-1 text-center text-xl font-bold text-neutral-100">
                Seu Agendamento
              </h1>
              <p className="mb-6 text-center text-sm text-neutral-500">
                Olá, <span className="text-neutral-300">{appointment.client_name}</span>!
              </p>

              {/* Card de detalhes */}
              <div className="mb-6 space-y-3 rounded-xl border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="size-4 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="capitalize text-neutral-200">{formattedDate}</p>
                    <p className="text-neutral-500">às {formattedTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Scissors className="size-4 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="text-neutral-200">{appointment.service_name}</p>
                    <p className="text-neutral-500">com {appointment.barber_name}</p>
                  </div>
                </div>
              </div>

              <p className="mb-6 text-center text-xs text-neutral-600">
                Cancelamentos podem ser feitos até {CANCEL_WINDOW_HOURS}h antes do horário.
              </p>

              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {cancelling ? 'Cancelando…' : 'Cancelar Agendamento'}
              </button>
            </>
          )}

          {/* CANCELADO COM SUCESSO */}
          {pageState === 'cancelled' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="size-12 text-emerald-400" />
              <div>
                <h2 className="text-lg font-bold text-neutral-100">Cancelado com sucesso</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Seu agendamento foi cancelado. O barbeiro foi notificado.
                </p>
              </div>
              <a
                href={bookingUrl}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                Agendar novo horário
              </a>
            </div>
          )}

          {/* JÁ CANCELADO */}
          {pageState === 'already-cancelled' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <XCircle className="size-12 text-neutral-600" />
              <div>
                <h2 className="text-lg font-bold text-neutral-100">Já cancelado</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Este agendamento já havia sido cancelado anteriormente.
                </p>
              </div>
              <a
                href={bookingUrl}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                Agendar novo horário
              </a>
            </div>
          )}

          {/* FORA DA JANELA */}
          {pageState === 'too-late' && appointment && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <Clock className="size-12 text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-neutral-100">Prazo esgotado</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Cancelamentos devem ser feitos com pelo menos {CANCEL_WINDOW_HOURS} horas de
                  antecedência. Seu horário é às {formattedTime}.
                </p>
                <p className="mt-2 text-xs text-neutral-600">
                  Para cancelar agora, entre em contato diretamente com a barbearia.
                </p>
              </div>
            </div>
          )}

          {/* NÃO ENCONTRADO */}
          {pageState === 'not-found' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <AlertTriangle className="size-12 text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-neutral-100">Agendamento não encontrado</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  O link pode estar expirado ou inválido.
                </p>
              </div>
            </div>
          )}

          {/* ERRO */}
          {pageState === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <AlertTriangle className="size-12 text-red-400" />
              <div>
                <h2 className="text-lg font-bold text-neutral-100">Algo deu errado</h2>
                <p className="mt-1 text-sm text-neutral-500">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
