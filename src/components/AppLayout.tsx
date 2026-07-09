import { useState, useMemo } from 'react'
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { buildPublicSiteUrl } from '@/lib/site'
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus'
import ShopSetup from '@/components/ShopSetup'
import { Loader2 } from 'lucide-react'
import { Sun, Moon, LogOut, Scissors, Calendar, Users, LayoutDashboard, MessageSquare, Menu, X, Contact, BarChart3, Globe, Settings, ShieldCheck } from 'lucide-react'

const baseNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/barbers', label: 'Barbeiros', icon: Users },
  { href: '/services', label: 'Serviços', icon: Scissors },
  { href: '/clients', label: 'Clientes', icon: Contact },
  { href: '/appointments', label: 'Agendamentos', icon: Calendar },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
]

const adminNavItems = [
  { href: '/admin', label: 'Admin', icon: ShieldCheck },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

function AppLayout() {
  const { user, shop, loading, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { state: waState } = useWhatsAppStatus(shop?.id)
  const navItems = useMemo(() => {
    if (isAdmin && !shop) return adminNavItems
    if (isAdmin) return [...baseNavItems, ...adminNavItems]
    return baseNavItems
  }, [isAdmin, shop])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900">
        <Loader2 className="size-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!shop && !isAdmin) {
    return <ShopSetup />
  }

  // Admin sem loja própria: só pode acessar /admin
  if (isAdmin && !shop && location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="flex min-h-screen">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-indigo-950 via-indigo-950 to-indigo-900 p-4 text-white transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
            <Scissors className="size-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="bg-gradient-to-r from-indigo-200 to-blue-200 bg-clip-text text-xl font-black tracking-tight text-transparent">AppBarber</h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-300/60">Gestão</p>
          </div>
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 text-indigo-300 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.href
            return (
              <Button
                key={item.href}
                className={`justify-start transition-all duration-200 ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-500'
                    : 'bg-transparent text-indigo-200 hover:bg-white/10 hover:text-white'
                }`}
                onClick={() => { navigate(item.href); setSidebarOpen(false) }}
              >
                <Icon className="mr-2 size-4" /> {item.label}
              </Button>
            )
          })}
          {shop ? (
            <Button
              className="justify-start bg-transparent text-indigo-200 hover:bg-white/10 hover:text-white transition-all duration-200"
              onClick={() => window.open(buildPublicSiteUrl(shop.public_slug), '_blank')}
            >
              <Globe className="mr-2 size-4" /> Site Público
            </Button>
          ) : null}
        </nav>

        {/* WhatsApp Status Badge */}
        {waState !== 'loading' && waState !== 'unknown' && (
          <button
            onClick={() => { navigate('/whatsapp'); setSidebarOpen(false) }}
            title={waState === 'connected' ? 'WhatsApp conectado' : 'WhatsApp desconectado — clique para configurar'}
            className={`mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
              waState === 'connected'
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-red-500/15 text-red-300 hover:bg-red-500/25 animate-pulse'
            }`}
          >
            <span className={`size-2 rounded-full flex-shrink-0 ${
              waState === 'connected' ? 'bg-emerald-400' : 'bg-red-400'
            }`} />
            <MessageSquare className="size-3 flex-shrink-0" />
            {waState === 'connected' ? 'WhatsApp Ativo' : 'WhatsApp Offline'}
          </button>
        )}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-indigo-200 hover:bg-white/10 hover:text-white">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate('/login') }} className="text-indigo-200 hover:bg-white/10 hover:text-white">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Top Bar */}
        <header className="flex items-center justify-between bg-gradient-to-r from-indigo-950 to-indigo-900 px-4 py-3 text-white lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-indigo-200 hover:text-white">
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md">
              <Scissors className="size-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="font-bold tracking-tight">AppBarber</p>
              <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-indigo-300/50">Gestão</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-indigo-200 hover:text-white">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
