import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { Sun, Moon, LogOut, Scissors, Calendar, Users, LayoutDashboard, MessageSquare, Menu, X, Contact } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/barbers', label: 'Barbeiros', icon: Users },
  { href: '/services', label: 'Serviços', icon: Scissors },
  { href: '/clients', label: 'Clientes', icon: Contact },
  { href: '/appointments', label: 'Agendamentos', icon: Calendar },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
]

function AppLayout() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Button onClick={() => navigate('/login')}>
          Fazer Login
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between rounded-lg border bg-card/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Scissors className="size-4" />
            </div>
            <span className="text-lg font-bold">AppBarber</span>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
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
                variant={active ? 'secondary' : 'ghost'}
                className="justify-start"
                onClick={() => { navigate(item.href); setSidebarOpen(false) }}
              >
                <Icon className="mr-2 size-4" /> {item.label}
              </Button>
            )
          })}
        </nav>
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate('/login') }}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Top Bar */}
        <header className="flex items-center justify-between border-b p-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Scissors className="size-5" />
            <span className="font-bold">AppBarber</span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
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
