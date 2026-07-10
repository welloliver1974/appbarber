import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, AtSign, MapPin, Phone, Scissors, User, ChevronDown, Star, Sparkles, Clock, Calendar, ArrowLeft, ArrowRight, Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { loadPublicShopContext, resolvePublicShopSlug } from '@/lib/public-site'
import { getAvailableSlots } from '@/lib/availability'
import { getUTC3DateKey } from '@/lib/timezone'
import { sendText } from '@/lib/evolution'
import type { Barber, Service, Shop } from '@/types/database'

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

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const DAY_LABELS: Record<string, string> = {
  domingo: 'Domingo',
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
}

const DAY_ORDER = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

const TESTIMONIALS = [
  {
    name: 'Carlos Mendes',
    text: 'Atendimento excepcional e ambiente de altíssimo nível. O corte foi impecável e a pontualidade me conquistou de verdade.',
    rating: 5,
    date: 'Há 2 dias',
  },
  {
    name: 'Bruno Rodrigues',
    text: 'Melhor barbearia de Santo André. O agendamento online é extremamente simples e o serviço de toalha quente é sensacional.',
    rating: 5,
    date: 'Há 1 semana',
  },
  {
    name: 'Rafael Souza',
    text: 'Cabelo e barba perfeitos. O café é de cortesia e de excelente qualidade. Recomendo de olhos fechados pela excelência.',
    rating: 5,
    date: 'Há 2 semanas',
  },
]

function getSlugFromPath(): string | null {
  const match = window.location.pathname.match(/^\/public\/([^/]+)/)
  return match?.[1] ?? null
}

/** Lê o parâmetro ?barber= da URL para deep-links de marketing */
function getBarberParamFromURL(): string | null {
  return new URLSearchParams(window.location.search).get('barber')
}

/** Normaliza string para comparação (lowercase, sem acentos e sem espaços) */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function getServiceCategory(name: string): 'cabelo' | 'barba' | 'combos' {
  const lower = name.toLowerCase()
  if (lower.includes('combo') || lower.includes('complete') || lower.includes('+') || lower.includes('especial')) return 'combos'
  if (lower.includes('barba') || lower.includes('barbear') || lower.includes('toalha') || lower.includes('navalha')) return 'barba'
  return 'cabelo'
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null!)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('animate-fade-in')
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

function SectionHeading({ overline, title }: { overline: string; title: string }) {
  return (
    <div className="mb-12 text-center">
      <span className="text-[10px] uppercase tracking-[0.25em] text-amber-500 font-semibold">{overline}</span>
      <h2 className="mt-3 text-3xl font-display leading-tight sm:text-4xl text-neutral-100">{title}</h2>
      <div className="mx-auto mt-4 h-0.5 w-16 bg-gradient-to-r from-amber-500 to-transparent" />
    </div>
  )
}

function PublicSite() {
  const slug = getSlugFromPath() ?? resolvePublicShopSlug()

  const [loading, setLoading] = useState(true)
  const [shop, setShop] = useState<Shop | null>(null)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  
  // Wizard state
  const [step, setStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'todos' | 'cabelo' | 'barba' | 'combos'>('todos')

  const [barberId, setBarberId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const toggleServiceSelection = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  useEffect(() => {
    async function load() {
      try {
        const context = await loadPublicShopContext(slug)
        if (!context) {
          setError('Nenhuma barbearia encontrada')
          setShop(null)
          setBarbers([])
          setServices([])
          return
        }
        setShop(context.shop)
        setBarbers(context.barbers)
        setServices(context.services)
        setError('')

        // ── Etapa 1: Barber Slug deep-link ──
        // Se a URL contiver ?barber=<id|nome|slug>, auto-seleciona o barbeiro
        // e avança o wizard direto para a etapa de Serviços (step 2).
        const barberParam = getBarberParamFromURL()
        if (barberParam && context.barbers.length > 0) {
          const paramSlug = slugify(barberParam)
          const match = context.barbers.find(
            (b) =>
              b.id === barberParam ||
              slugify(b.name) === paramSlug ||
              slugify(b.name).startsWith(paramSlug)
          )
          if (match) {
            setBarberId(match.id)
            setStep(2)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as informações')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  const selectedServices = useMemo(() => {
    return services.filter((s) => serviceIds.includes(s.id))
  }, [services, serviceIds])

  const totalDuration = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0)
  }, [selectedServices])

  const totalBuffer = useMemo(() => {
    return selectedServices.length > 0
      ? Math.max(...selectedServices.map((s) => s.buffer_minutes ?? 0))
      : 0
  }, [selectedServices])

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + Number(s.price), 0)
  }, [selectedServices])

  const selectedBarber = barbers.find((barber) => barber.id === barberId)

  // Fetch slots
  useEffect(() => {
    if (!shop || !barberId || serviceIds.length === 0 || !date) {
      setAvailableSlots([])
      return
    }
    let active = true
    setTime('')
    setLoadingSlots(true)
    getAvailableSlots(barberId, date, totalDuration + totalBuffer)
      .then((slots) => { if (active) setAvailableSlots(slots) })
      .catch(() => { if (active) setAvailableSlots([]) })
      .finally(() => { if (active) setLoadingSlots(false) })
    return () => { active = false }
  }, [shop?.id, barberId, serviceIds.join(','), date, totalDuration, totalBuffer])

  const dateList = useMemo(() => {
    const days = []
    const today = getUTC3DateKey()
    const start = new Date(`${today}T12:00:00-03:00`)
    const workingHours = shop?.working_hours ?? {}

    for (let i = 0; i < 14; i++) {
      const current = new Date(start)
      current.setDate(start.getDate() + i)
      
      const yyyy = current.getFullYear()
      const mm = String(current.getMonth() + 1).padStart(2, '0')
      const dd = String(current.getDate()).padStart(2, '0')
      const dateKey = `${yyyy}-${mm}-${dd}`
      
      const dayOfWeek = current.getDay()
      const dayNameLower = DAY_ORDER[dayOfWeek] ?? ''
      const hasHours = !!(workingHours[dayNameLower] || workingHours[DAY_LABELS[dayNameLower]]);
      
      const weekday = current.toLocaleDateString('pt-BR', { weekday: 'short' })
      const weekdayClean = (weekday.charAt(0).toUpperCase() + weekday.slice(1)).replace('.', '')
      
      const dayNum = current.getDate()
      const monthName = current.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      
      days.push({
        dateKey,
        weekday: weekdayClean,
        dayNum,
        monthName,
        isSunday: dayOfWeek === 0,
        isOpen: dayOfWeek === 0 ? hasHours : true
      })
    }
    return days
  }, [shop?.working_hours])

  const bookingSummary = useMemo(() => {
    return {
      barberName: selectedBarber?.name ?? 'Pendente',
      serviceName: selectedServices.length > 0 ? selectedServices.map((s) => s.name).join(', ') : 'Pendente',
      price: selectedServices.length > 0 ? formatMoney(totalPrice) : 'Pendente',
      duration: totalDuration,
      timeLabel: time || 'Pendente',
      dateLabel: date ? new Date(`${date}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pendente',
      phoneLabel: normalizePhone(phone) ? formatPhoneInput(phone) : 'Pendente',
    }
  }, [selectedBarber?.name, selectedServices, totalPrice, totalDuration, date, time, phone])

  const whatsappLink = shop?.phone ? `https://wa.me/${normalizePhone(shop.phone)}` : ''
  const instagramLink = shop?.instagram ? `https://instagram.com/${shop.instagram.replace(/^@/, '')}` : null
  const galleryPhotos: string[] = Array.isArray(shop?.gallery_photos) ? shop.gallery_photos : []
  const workingHours: Record<string, string> = shop?.working_hours ?? {}

  // Filter slots by morning, afternoon, evening
  function getPeriod(slot: string) {
    const h = parseInt(slot.split(':')[0], 10)
    if (h < 12) return 'manha'
    if (h < 18) return 'tarde'
    return 'noite'
  }

  const manhaSlots = availableSlots.filter((s) => getPeriod(s) === 'manha')
  const tardeSlots = availableSlots.filter((s) => getPeriod(s) === 'tarde')
  const noiteSlots = availableSlots.filter((s) => getPeriod(s) === 'noite')

  // Filter services by category and search query
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (s.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      
      const category = getServiceCategory(s.name)
      const matchesCategory = activeCategory === 'todos' || category === activeCategory

      return matchesSearch && matchesCategory
    })
  }, [services, searchQuery, activeCategory])

  function resetForm() {
    setBarberId('')
    setServiceIds([])
    setDate('')
    setTime('')
    setName('')
    setPhone('')
    setError('')
    setSuccess(false)
    setAvailableSlots([])
    setStep(1)
  }

  function canProceed(stepNum: number) {
    switch (stepNum) {
      case 1: return serviceIds.length > 0
      case 2: return !!barberId
      case 3: return !!date && !!time
      case 4: return !!name.trim() && normalizePhone(phone).length >= 10
      default: return false
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!shop) return
    const cleanPhone = normalizePhone(phone)
    if (!barberId || serviceIds.length === 0 || !date || !time || !name.trim() || cleanPhone.length < 10) {
      setError('Preencha todas as informações para finalizar seu agendamento')
      return
    }
    setSaving(true)
    setError('')
    try {
      const duration = totalDuration
      const buffer = totalBuffer
      const stillAvailable = await getAvailableSlots(barberId, date, duration + buffer)
      if (!stillAvailable.includes(time)) {
        setError('Infelizmente, este horário não está mais disponível. Por favor, escolha outro.')
        setSaving(false)
        return
      }
      let clientId = ''
      const { data: existing } = await supabase
        .from('clients').select('id').eq('shop_id', shop.id).eq('phone', cleanPhone).maybeSingle()
      if (existing) {
        clientId = existing.id as string
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients').insert({ shop_id: shop.id, name: name.trim(), phone: cleanPhone }).select('id').single()
        if (clientError) throw clientError
        if (!newClient) throw new Error('Não foi possível registrar o cliente')
        clientId = newClient.id as string
      }
      const startTime = buildISO(date, time)
      const endTime = new Date(startTime.getTime() + duration * 60000)

      const serviceNames = selectedServices.map((s) => s.name).join(', ')
      const notes = `Serviços: ${serviceNames}`

      const { error: appointmentError } = await supabase.from('appointments').insert({
        shop_id: shop.id, barber_id: barberId, service_id: serviceIds[0],
        client_id: clientId, start_time: startTime.toISOString(),
        end_time: endTime.toISOString(), status: 'pending',
        price_at_booking: totalPrice,
        notes,
      })
      if (appointmentError) throw appointmentError
      
      const readableDate = new Date(`${date}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
      const message = [
        '💈 *' + shop.name + '*',
        '',
        `Olá ${name.trim()}, seu agendamento foi realizado e aguarda confirmação!`,
        '',
        `📅 *Data:* ${readableDate}`,
        `⏰ *Horário:* ${time}`,
        `✂️ *Serviços:* ${selectedServices.map((s) => s.name).join(' + ')}`,
        `💰 *Valor Total:* ${formatMoney(totalPrice)}`,
        `👤 *Profissional:* ${selectedBarber?.name}`,
        '',
        'Agradecemos a preferência! Te esperamos lá.',
      ].join('\n')
      
      const sent = await sendText({ number: cleanPhone, text: message, shopId: shop.id })
      if (sent) toast.success('Confirmação enviada no seu WhatsApp!')
      else toast.warning('Agendamento criado! Notificação de WhatsApp pendente.')
      setSuccess(true)
    } catch (submitError) {
      console.error('[Booking] submitError:', submitError)
      const msg = submitError instanceof Error
        ? submitError.message
        : typeof submitError === 'object' && submitError !== null
          ? (submitError as any).message || (submitError as any).error || (submitError as any).description || JSON.stringify(submitError)
          : String(submitError)
      setError(msg)
    } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" />
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Carregando experiência premium...</p>
        </div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white">
        <Card className="w-full max-w-md border-white/[0.06] bg-white/[0.02] text-white backdrop-blur-md">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/25">
              <Scissors className="size-6 text-amber-500" />
            </div>
            <h1 className="text-xl font-display">Barbearia não encontrada</h1>
            <p className="mt-2 text-sm text-white/40">O link de acesso utilizado é inválido ou a loja correspondente não foi configurada.</p>
            {error ? <p className="mt-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center relative overflow-hidden">
        {/* Glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-amber-500/5 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-xl w-full px-4 py-12 relative z-10">
          <Card className="w-full border-amber-500/20 bg-neutral-900/40 text-white backdrop-blur-md shadow-2xl">
            <CardContent className="p-8 text-center space-y-6">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
                <CheckCircle className="size-8 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-display text-neutral-100">Solicitação Confirmada!</h2>
                <p className="text-sm text-white/50">Seu horário foi reservado. Detalhes enviados via WhatsApp.</p>
              </div>
              
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 text-left space-y-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-semibold">Resumo do Serviço</p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40">Serviço</span>
                    <span className="font-medium text-white">{bookingSummary.serviceName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40">Profissional</span>
                    <span className="font-medium text-white">{bookingSummary.barberName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40">Data e Hora</span>
                    <span className="font-medium text-white">{bookingSummary.dateLabel} às {bookingSummary.timeLabel}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40">Valor</span>
                    <span className="font-semibold text-amber-400">{bookingSummary.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">WhatsApp</span>
                    <span className="font-medium text-white">{bookingSummary.phoneLabel}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
                <Button onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="bg-amber-500 text-neutral-950 hover:bg-amber-600 font-bold transition-all px-6">
                  Novo agendamento
                </Button>
                <Button variant="outline" onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="border-white/[0.12] text-white hover:bg-white/5">
                  Voltar ao início
                </Button>
                {whatsappLink ? (
                  <Button variant="outline" className="border-white/[0.12] text-white hover:bg-white/5" onClick={() => window.open(whatsappLink, '_blank')}>
                    Falar com a Barbearia
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const heroPhoto = shop.hero_photo
  const heroBg = heroPhoto
    ? `linear-gradient(rgba(5, 5, 5, 0.70), rgba(5, 5, 5, 0.90)), url(${heroPhoto})`
    : 'linear-gradient(180deg, #0e0e0e 0%, #050505 100%)'
  const bookingBg = heroPhoto
    ? `linear-gradient(rgba(5, 5, 5, 0.70), rgba(5, 5, 5, 0.88)), url(${heroPhoto})`
    : undefined

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans relative">
      
      {/* Background radial lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/4 size-[500px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 size-[600px] rounded-full bg-amber-600/[0.02] blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 size-[500px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
      </div>

      {/* ── Hero ── */}
      <section
        className="relative flex min-h-screen items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: heroBg }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
        <div className="mx-auto max-w-3xl px-4 py-24 text-center relative z-10">
          <div className="animate-fade-in flex flex-col items-center gap-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 border border-amber-500/25">
              <Sparkles className="size-3" />
              Barbearia Exclusiva
            </span>
            
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="size-28 rounded-full border-2 border-amber-500/20 object-cover shadow-2xl" />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-full bg-neutral-900 border border-white/[0.08] shadow-2xl">
                <Scissors className="size-10 text-amber-500" />
              </div>
            )}
            
            <h1 className="text-5xl font-display leading-tight sm:text-7xl tracking-wide text-white">{shop.name}</h1>
            <p className="text-base text-neutral-400 sm:text-lg max-w-xl leading-relaxed">
              Onde a tradição encontra o estilo moderno. Reserve sua experiência premium com nossos profissionais altamente qualificados.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-neutral-400 pt-2">
              {shop.address ? (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4 text-amber-500" />{shop.address}
                </span>
              ) : null}
              {shop.phone ? (
                <span className="inline-flex items-center gap-2">
                  <Phone className="size-4 text-amber-500" />{formatPhoneInput(shop.phone)}
                </span>
              ) : null}
            </div>
            
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <a href="#agendar" className="h-11 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold transition-all px-8 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20">
                Agendar Horário
              </a>
              {whatsappLink ? (
                <Button
                  variant="outline"
                  className="border-white/[0.08] text-white hover:bg-white/5 px-8 h-11 rounded-full"
                  onClick={() => window.open(whatsappLink, '_blank')}
                >
                  Falar no WhatsApp
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="size-5 text-neutral-500" />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-24 space-y-32">

        {/* ── Serviços ── */}
        <ScrollRevealSection>
          <SectionHeading overline="Cardápio" title="Nossos serviços" />
          {services.length === 0 ? (
            <p className="text-center text-sm text-neutral-500">Nenhum serviço disponível no momento.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div key={service.id} className="group rounded-2xl border border-white/[0.05] bg-neutral-900/30 p-6 backdrop-blur-md transition-all duration-300 hover:border-amber-500/20 hover:bg-neutral-900/50 flex flex-col justify-between h-full">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors">{service.name}</h3>
                      <span className="shrink-0 font-semibold text-amber-500">{formatMoney(Number(service.price))}</span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-neutral-400 leading-relaxed">{service.description}</p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/[0.03] flex items-center gap-1.5 text-xs text-neutral-500">
                    <Clock className="size-3.5" />
                    <span>{service.duration_minutes} minutos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollRevealSection>

        {/* ── Equipe ── */}
        <ScrollRevealSection>
          <SectionHeading overline="Profissionais" title="Especialistas da Casa" />
          {barbers.length === 0 ? (
            <p className="text-center text-sm text-neutral-500">Nenhum barbeiro disponível no momento.</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {barbers.map((barber) => (
                <div key={barber.id} className="group rounded-2xl border border-white/[0.05] bg-neutral-900/30 p-6 text-center backdrop-blur-md transition-all duration-300 hover:border-amber-500/20 hover:bg-neutral-900/50">
                  <div className="relative mx-auto size-24 mb-4">
                    {barber.photo_url ? (
                      <img
                        src={barber.photo_url}
                        alt={barber.name}
                        className="size-full rounded-full border-2 border-white/5 object-cover group-hover:border-amber-500/30 transition-all duration-300"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center rounded-full bg-neutral-800 border border-white/5 text-neutral-500 group-hover:border-amber-500/30 transition-all">
                        <User className="size-10 text-neutral-400" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors">{barber.name}</h3>
                  <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{barber.bio || 'Especialista em barbearia clássica e moderna com foco na excelência e estilo.'}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollRevealSection>
      </main>

        {/* ── Agendamento Widget (full-width) ── */}
        <section
          className="relative bg-cover bg-center bg-no-repeat"
          style={bookingBg ? { backgroundImage: bookingBg } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505] pointer-events-none" />
          <div className="relative z-10 py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-4">
          <ScrollRevealSection>
          <div id="agendar" className="scroll-mt-12">
            <SectionHeading overline="Reserva" title="Agende sua experiência" />
            <div className="rounded-2xl border border-white/[0.05] bg-neutral-900/30 overflow-hidden backdrop-blur-md">
              <div className="grid gap-8 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
                
                {/* Stepper Content */}
                <div className="space-y-6">
                  {/* Step indicators */}
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (s < step) setStep(s)
                          }}
                          disabled={s >= step}
                          className={`size-8 rounded-full border text-xs font-bold flex items-center justify-center transition-all ${
                            step === s
                              ? 'border-amber-500 bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20'
                              : step > s
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-pointer'
                              : 'border-white/5 bg-white/[0.01] text-neutral-500 cursor-not-allowed'
                          }`}
                        >
                          {step > s ? <Check className="size-3.5" /> : s}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">Etapa {step} de 4</span>
                  </div>

                  {/* STEP 1: SERVICES SELECTION */}
                  {step === 1 && (
                    <div className="space-y-5 animate-fade-in-up">
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                        <h3 className="text-lg font-medium text-white">Selecione o serviço</h3>
                        {/* Search and Tabs */}
                        <div className="relative max-w-xs w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                          <input
                            type="text"
                            placeholder="Buscar serviço..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 w-full rounded-xl border border-white/5 bg-white/[0.02] pl-9 pr-3 text-xs text-white outline-none focus:border-amber-500/30 focus:bg-white/[0.04] transition"
                          />
                        </div>
                      </div>

                      {/* Categories filter tabs */}
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {(['todos', 'cabelo', 'barba', 'combos'] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-all ${
                              activeCategory === cat
                                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                                : 'border-white/5 bg-white/[0.01] text-neutral-400 hover:text-white hover:border-white/10'
                            }`}
                          >
                            {cat === 'todos' ? 'Todos' : cat === 'combos' ? 'Combos' : cat}
                          </button>
                        ))}
                      </div>

                      {filteredServices.length === 0 ? (
                        <p className="py-8 text-center text-sm text-neutral-500">Nenhum serviço correspondente encontrado.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 max-h-[360px] overflow-y-auto pr-1">
                          {filteredServices.map((s) => {
                            const isSel = serviceIds.includes(s.id)
                            return (
                              <div
                                key={s.id}
                                onClick={() => toggleServiceSelection(s.id)}
                                className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-300 flex flex-col justify-between ${
                                  isSel
                                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                                    : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.12] hover:bg-white/[0.03]'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex justify-between items-start gap-3">
                                    <h4 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">{s.name}</h4>
                                    <span className="shrink-0 text-sm font-semibold text-amber-500">{formatMoney(Number(s.price))}</span>
                                  </div>
                                  {s.description && (
                                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">{s.description}</p>
                                  )}
                                </div>
                                <div className="mt-3 pt-2 border-t border-white/[0.02] flex items-center justify-between text-[11px] text-neutral-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {s.duration_minutes} min {s.buffer_minutes ? `(+${s.buffer_minutes}m limpeza)` : ''}
                                  </span>
                                  {isSel ? (
                                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                                      <Check className="size-3 flex-shrink-0" /> Selecionado
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600">Selecionar</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={() => setStep(2)}
                          disabled={serviceIds.length === 0}
                          className="bg-amber-500 text-neutral-950 hover:bg-amber-600 font-bold transition-all rounded-xl"
                        >
                          Avançar <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: BARBER SELECTION */}
                  {step === 2 && (
                    <div className="space-y-5 animate-fade-in-up">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setStep(1)} className="text-neutral-500 hover:text-white transition">
                          <ArrowLeft className="size-5" />
                        </button>
                        <h3 className="text-lg font-medium text-white">Escolha o profissional</h3>
                      </div>

                      {barbers.length === 0 ? (
                        <p className="py-8 text-center text-sm text-neutral-500">Nenhum barbeiro ativo disponível.</p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 max-h-[360px] overflow-y-auto pr-1">
                          {barbers.map((b) => {
                            const isSel = barberId === b.id
                            return (
                              <div
                                key={b.id}
                                onClick={() => {
                                  setBarberId(b.id)
                                  setTimeout(() => setStep(3), 220)
                                }}
                                className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-300 flex items-center gap-4 ${
                                  isSel
                                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                                    : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.12] hover:bg-white/[0.03]'
                                }`}
                              >
                                <div className="relative shrink-0 size-16">
                                  {b.photo_url ? (
                                    <img
                                      src={b.photo_url}
                                      alt={b.name}
                                      className="size-full rounded-full object-cover border border-white/10 group-hover:border-amber-500/30 transition-all"
                                    />
                                  ) : (
                                    <div className="flex size-full items-center justify-center rounded-full bg-neutral-800 border border-white/10 text-neutral-500 group-hover:border-amber-500/30 transition-all">
                                      <User className="size-6 text-neutral-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">{b.name}</h4>
                                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">{b.bio || 'Profissional especialista da casa.'}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex justify-between pt-2">
                        <Button variant="ghost" onClick={() => setStep(1)} className="text-neutral-400 hover:text-white rounded-xl">
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setStep(3)}
                          disabled={!barberId}
                          className="bg-amber-500 text-neutral-950 hover:bg-amber-600 font-bold transition-all rounded-xl"
                        >
                          Avançar <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: DATE & TIME SELECTION */}
                  {step === 3 && (
                    <div className="space-y-5 animate-fade-in-up">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setStep(2)} className="text-neutral-500 hover:text-white transition">
                          <ArrowLeft className="size-5" />
                        </button>
                        <h3 className="text-lg font-medium text-white">Escolha a data e hora</h3>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-550 flex items-center gap-1.5"><Calendar className="size-3.5" /> Próximos dias disponíveis</label>
                        <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                          {dateList.map((d) => {
                            const isSelected = date === d.dateKey
                            const isDisabled = !d.isOpen
                            return (
                              <button
                                key={d.dateKey}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => {
                                  setDate(d.dateKey)
                                  setTime('')
                                }}
                                className={`flex min-w-[70px] shrink-0 flex-col items-center rounded-2xl border py-3 transition-all duration-300 ${
                                  isSelected
                                    ? 'border-amber-500 bg-amber-500/10 text-white shadow-lg shadow-amber-500/5 scale-105'
                                    : isDisabled
                                    ? 'border-white/[0.02] bg-white/[0.01] opacity-25 cursor-not-allowed'
                                    : 'border-white/[0.04] bg-white/[0.01] text-neutral-400 hover:border-white/10 hover:text-white'
                                }`}
                              >
                                <span className="text-[9px] uppercase tracking-wider opacity-60 font-semibold">{d.weekday}</span>
                                <span className="mt-1 text-base font-bold text-white">{d.dayNum}</span>
                                <span className="text-[9px] uppercase tracking-wider opacity-60 font-semibold">{d.monthName}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-550 flex items-center gap-1.5"><Clock className="size-3.5" /> Horários disponíveis</label>
                        {loadingSlots ? (
                          <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-neutral-500">
                            <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-amber-500" />
                            <span>Verificando agenda do profissional...</span>
                          </div>
                        ) : !date ? (
                          <div className="rounded-2xl border border-white/[0.03] bg-white/[0.01] py-8 text-center text-sm text-neutral-500">
                            Selecione uma data acima para visualizar a grade de horários.
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-5 text-center text-sm text-amber-550">
                            Nenhum horário disponível para este profissional nesta data. Tente outra data.
                          </div>
                        ) : (
                          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                            {manhaSlots.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">Manhã (antes de 12:00)</p>
                                <div className="flex flex-wrap gap-2">
                                  {manhaSlots.map((slot) => (
                                    <button
                                      type="button"
                                      key={slot}
                                      onClick={() => setTime(slot)}
                                      className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                                        time === slot
                                          ? 'border-amber-500 bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/10'
                                          : 'border-white/[0.04] bg-white/[0.01] text-neutral-300 hover:border-white/10 hover:bg-white/[0.03]'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {tardeSlots.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">Tarde (12:00 às 18:00)</p>
                                <div className="flex flex-wrap gap-2">
                                  {tardeSlots.map((slot) => (
                                    <button
                                      type="button"
                                      key={slot}
                                      onClick={() => setTime(slot)}
                                      className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                                        time === slot
                                          ? 'border-amber-500 bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/10'
                                          : 'border-white/[0.04] bg-white/[0.01] text-neutral-300 hover:border-white/10 hover:bg-white/[0.03]'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {noiteSlots.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">Noite (após 18:00)</p>
                                <div className="flex flex-wrap gap-2">
                                  {noiteSlots.map((slot) => (
                                    <button
                                      type="button"
                                      key={slot}
                                      onClick={() => setTime(slot)}
                                      className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                                        time === slot
                                          ? 'border-amber-500 bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/10'
                                          : 'border-white/[0.04] bg-white/[0.01] text-neutral-300 hover:border-white/10 hover:bg-white/[0.03]'
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

                      <div className="flex justify-between pt-2">
                        <Button variant="ghost" onClick={() => setStep(2)} className="text-neutral-400 hover:text-white rounded-xl">
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setStep(4)}
                          disabled={!date || !time}
                          className="bg-amber-500 text-neutral-950 hover:bg-amber-600 font-bold transition-all rounded-xl"
                        >
                          Avançar <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: CLIENT DETAILS & FORM */}
                  {step === 4 && (
                    <div className="space-y-5 animate-fade-in-up">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setStep(3)} className="text-neutral-500 hover:text-white transition">
                          <ArrowLeft className="size-5" />
                        </button>
                        <h3 className="text-lg font-medium text-white">Preencha seus dados</h3>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Seu Nome</label>
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Nome completo"
                              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-sm text-white outline-none transition focus:border-amber-500/30 focus:bg-white/[0.04] placeholder:text-white/20"
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-550">WhatsApp</label>
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                              placeholder="(11) 99999-8888"
                              inputMode="numeric"
                              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-sm text-white outline-none transition focus:border-amber-500/30 focus:bg-white/[0.04] placeholder:text-white/20"
                              required
                            />
                          </div>
                        </div>

                        {error ? (
                          <div className="p-3 text-xs text-rose-450 border border-rose-500/20 bg-rose-500/10 rounded-xl">
                            {error}
                          </div>
                        ) : null}

                        <div className="flex justify-between items-center pt-2">
                          <Button type="button" variant="ghost" onClick={() => setStep(3)} className="text-neutral-400 hover:text-white rounded-xl">
                            Voltar
                          </Button>
                          
                          <Button
                            type="submit"
                            disabled={saving || !canProceed(4)}
                            className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold transition-all px-8 rounded-xl shadow-lg shadow-amber-500/10"
                          >
                            {saving ? (
                              <span className="flex items-center gap-1.5">
                                <span className="size-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
                                Confirmando...
                              </span>
                            ) : (
                              'Finalizar Agendamento'
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {/* Live Sticky Summary Sidebar */}
                <aside className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 h-fit lg:sticky lg:top-8 flex flex-col justify-between space-y-5">
                  <div>
                    <div className="mb-4 flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-md">
                        <Scissors className="size-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Resumo da Reserva</h3>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Acompanhamento em tempo real</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3.5 border-t border-white/[0.03] pt-4 text-xs">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-neutral-550">Serviço Selecionado</p>
                        <p className="mt-0.5 font-medium text-white text-sm">{bookingSummary.serviceName}</p>
                        {selectedServices.length > 0 && (
                          <div className="mt-1 flex items-center justify-between text-neutral-500 text-[11px]">
                            <span>Duração: {bookingSummary.duration} min</span>
                            <span className="font-semibold text-amber-400">{bookingSummary.price}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-neutral-550">Profissional Selecionado</p>
                        <p className="mt-0.5 font-medium text-white text-sm">{bookingSummary.barberName}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-neutral-550">Data Escolhida</p>
                          <p className="mt-0.5 font-medium text-white text-sm">{bookingSummary.dateLabel}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-neutral-550">Horário Escolhido</p>
                          <p className="mt-0.5 font-medium text-white text-sm">{bookingSummary.timeLabel}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-neutral-550">Seu WhatsApp</p>
                        <p className="mt-0.5 font-medium text-white text-sm">{bookingSummary.phoneLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.03] p-3 text-[10px] text-neutral-500 text-center leading-relaxed">
                    Horários exibidos e operados no fuso oficial de Brasília (UTC-3).
                  </div>
                </aside>

              </div>
            </div>
          </div>
        </ScrollRevealSection>
          </div>
        </div>
        </section>

      <main className="mx-auto max-w-6xl px-4 py-24 space-y-32">

        {/* ── Depoimentos / Social Proof ── */}
        <ScrollRevealSection>
          <SectionHeading overline="Avaliações" title="Opinião de quem frequenta" />
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="rounded-2xl border border-white/[0.05] bg-neutral-900/30 p-6 backdrop-blur-md space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex gap-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="size-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <p className="text-sm text-neutral-400 italic leading-relaxed">"{t.text}"</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.03] text-xs text-neutral-500">
                  <span className="font-semibold text-white">{t.name}</span>
                  <span>{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollRevealSection>

        {/* ── Galeria ── */}
        {galleryPhotos.length > 0 ? (
          <ScrollRevealSection>
            <SectionHeading overline="Espaço" title="Nosso ambiente" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {galleryPhotos.map((photo, idx) => (
                <div key={idx} className="group overflow-hidden rounded-2xl border border-white/[0.05] bg-neutral-900/30 backdrop-blur-md relative aspect-square">
                  <img
                    src={photo}
                    alt={`Foto do Espaço ${idx + 1}`}
                    className="size-full object-cover transition duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              ))}
            </div>
          </ScrollRevealSection>
        ) : null}

        {/* ── Localização + Horários ── */}
        <ScrollRevealSection>
          <SectionHeading overline="Informações" title="Contato & Localização" />
          <div className="grid gap-6 md:grid-cols-2">
            {shop.address || shop.phone || instagramLink ? (
              <div className="rounded-2xl border border-white/[0.05] bg-neutral-900/30 p-6 backdrop-blur-md space-y-6">
                {shop.address ? (
                  <InfoBlock icon={<MapPin className="size-5 text-amber-500" />} label="Endereço Completo" value={shop.address} />
                ) : null}
                {shop.phone ? (
                  <InfoBlock icon={<Phone className="size-5 text-amber-500" />} label="WhatsApp de Contato" value={formatPhoneInput(shop.phone)} />
                ) : null}
                {instagramLink ? (
                  <InfoBlockWithLink icon={<AtSign className="size-5 text-amber-500" />} label="Instagram Oficial" href={instagramLink}>
                    @{shop.instagram?.replace(/^@/, '')}
                  </InfoBlockWithLink>
                ) : null}
                {shop.address ? (
                  <Button
                    variant="outline"
                    className="border-white/[0.08] text-white hover:bg-white/5 w-full mt-2 rounded-xl"
                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(shop.address ?? '')}`, '_blank')}
                  >
                    <MapPin className="mr-2 size-4 text-amber-500" />
                    Como Chegar (Google Maps)
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/[0.05] bg-neutral-900/30 p-6 backdrop-blur-md">
              <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-amber-500">Horário de Atendimento</p>
              <div className="space-y-3.5">
                {DAY_ORDER.map((day) => {
                  const hours = workingHours[day] || workingHours[DAY_LABELS[day]]
                  if (!hours) return null
                  return (
                    <div key={day} className="flex items-center justify-between border-b border-white/[0.03] pb-2 text-sm">
                      <span className="text-neutral-400 capitalize">{DAY_LABELS[day]}</span>
                      <span className="font-medium text-white">{hours}</span>
                    </div>
                  )
                })}
                {DAY_ORDER.every((day) => !workingHours[day] && !workingHours[DAY_LABELS[day]]) ? (
                  <p className="text-sm text-neutral-500">Horários não cadastrados.</p>
                ) : null}
              </div>
            </div>
          </div>
        </ScrollRevealSection>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] bg-black/40 backdrop-blur-md relative z-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-12 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-neutral-900 border border-white/10 text-amber-500 shadow-md">
              <Scissors className="size-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{shop.name}</p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Barbearia Premium</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-neutral-500">
            {instagramLink ? (
              <a href={instagramLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-amber-400 transition">
                <AtSign className="size-4" />
                Instagram
              </a>
            ) : null}
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-amber-400 transition">
                <Phone className="size-4" />
                WhatsApp
              </a>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <p className="text-xs text-neutral-500">&copy; 2026 {shop.name}. Todos os direitos reservados.</p>
            <p className="text-[10px] text-neutral-600">Desenvolvido com AppBarber</p>
          </div>
        </div>
      </footer>

    </div>
  )
}

/* ── Sub-components ── */

function ScrollRevealSection({ children }: { children: React.ReactNode }) {
  const ref = useScrollReveal()
  return (
    <section ref={ref} className="opacity-0 translate-y-4 transition-all duration-700 ease-out" style={{ willChange: 'opacity, transform' }}>
      {children}
    </section>
  )
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
        <p className="mt-1 text-sm text-neutral-350 leading-relaxed font-medium">{value}</p>
      </div>
    </div>
  )
}

function InfoBlockWithLink({ icon, label, href, children }: { icon: React.ReactNode; label: string; href: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
        <a href={href} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-neutral-350 hover:underline hover:text-amber-400 transition font-medium">{children}</a>
      </div>
    </div>
  )
}

export default PublicSite

