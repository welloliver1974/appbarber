import { lazy, Suspense, useEffect } from 'react'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import { shouldRenderPublicSite } from '@/lib/site'

const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Barbers = lazy(() => import('@/pages/Barbers'))
const Services = lazy(() => import('@/pages/Services'))
const Appointments = lazy(() => import('@/pages/Appointments'))
const Booking = lazy(() => import('@/pages/Booking'))
const Clients = lazy(() => import('@/pages/Clients'))
const WhatsAppSettings = lazy(() => import('@/pages/WhatsAppSettings'))
const Reports = lazy(() => import('@/pages/Reports'))
const PublicSite = lazy(() => import('@/pages/PublicSite'))
const ManageBooking = lazy(() => import('@/pages/ManageBooking'))
const ShopSettings = lazy(() => import('@/pages/ShopSettings'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))

function PageLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex min-h-screen items-center justify-center bg-background ${className}`}>
      <div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    </div>
  )
}

function PublicSiteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" />
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Carregando experiência premium...</p>
      </div>
    </div>
  )
}

function App() {
  // Register Service Worker for push notifications (feature flag)
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_BARBER_PUSH === 'true' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .catch(err => console.error('Service Worker registration failed:', err))
    }
  }, [])
  if (shouldRenderPublicSite()) {
    return (
      <Suspense fallback={<PublicSiteLoader />}>
        <PublicSite />
      </Suspense>
    )
  }

  return (
    <BrowserRouter><NotificationProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/public/:slug" element={<PublicSite />} />
          <Route path="/public/:slug/manage" element={<ManageBooking />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/barbers" element={<Barbers />} />
            <Route path="/services" element={<Services />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/whatsapp" element={<WhatsAppSettings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<ShopSettings />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Suspense>
    </NotificationProvider></BrowserRouter>
  )
}

export default App
