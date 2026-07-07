import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Barbers from '@/pages/Barbers'
import Services from '@/pages/Services'
import Appointments from '@/pages/Appointments'
import Booking from '@/pages/Booking'
import Clients from '@/pages/Clients'
import WhatsAppSettings from '@/pages/WhatsAppSettings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/booking" element={<Booking />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/barbers" element={<Barbers />} />
          <Route path="/services" element={<Services />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/whatsapp" element={<WhatsAppSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
