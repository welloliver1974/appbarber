export interface Shop {
  id: string
  owner_user_id: string | null
  auth_email: string | null
  public_slug: string | null
  name: string
  phone: string | null
  address: string | null
  logo_url: string | null
  instagram: string | null
  working_hours: Record<string, string> | null
  gallery_photos: string[] | null
  hero_photo: string | null
  created_at: string
  updated_at: string
}

export interface Barber {
  id: string
  shop_id: string
  name: string
  phone: string | null
  photo_url: string | null
  bio: string | null
  active: boolean
  notifications_enabled: boolean
  portfolio_photos: string[] | null
  created_at: string
  updated_at: string
}

export interface Testimonial {
  id: string
  shop_id: string
  client_name: string
  text: string
  rating: number
  created_at: string
}

export interface BarberAvailability {
  id: string
  barber_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

export interface Service {
  id: string
  shop_id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  active: boolean
  buffer_minutes: number | null
  created_at: string
  updated_at: string
}

export interface BarberService {
  id: string
  barber_id: string
  service_id: string
}

export interface AppointmentService {
  id: string
  appointment_id: string
  service_id: string
}

export interface Client {
  id: string
  shop_id: string
  phone: string
  name: string
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  shop_id: string
  barber_id: string
  client_id: string
  service_id: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  price_at_booking: number | null
  cancel_token: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WhatsAppConfig {
  id: string
  shop_id: string
  server_url: string
  instance_name: string
  api_key: string
  webhook_secret: string
  active: boolean
  reengage_interval_days: number | null
  created_at: string
  updated_at: string
}

export interface GoogleCalendarToken {
  id: string
  shop_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      shops: { Row: Shop; Insert: Omit<Shop, 'id' | 'created_at' | 'updated_at' | 'public_slug'> & { public_slug?: string | null }; Update: Partial<Omit<Shop, 'id'>> }
      barbers: { Row: Barber; Insert: Omit<Barber, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Barber, 'id'>> }
      barber_availability: { Row: BarberAvailability; Insert: Omit<BarberAvailability, 'id'>; Update: Partial<Omit<BarberAvailability, 'id'>> }
      services: { Row: Service; Insert: Omit<Service, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Service, 'id'>> }
      barber_services: { Row: BarberService; Insert: Omit<BarberService, 'id'>; Update: Partial<Omit<BarberService, 'id'>> }
      appointment_services: { Row: AppointmentService; Insert: Omit<AppointmentService, 'id'>; Update: Partial<Omit<AppointmentService, 'id'>> }
      clients: { Row: Client; Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Client, 'id'>> }
      appointments: { Row: Appointment; Insert: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Appointment, 'id'>> }
      whatsapp_configs: { Row: WhatsAppConfig; Insert: Omit<WhatsAppConfig, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<WhatsAppConfig, 'id'>> }
      google_calendar_tokens: { Row: GoogleCalendarToken; Insert: Omit<GoogleCalendarToken, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<GoogleCalendarToken, 'id'>> }
      testimonials: { Row: Testimonial; Insert: Omit<Testimonial, 'id' | 'created_at'>; Update: Partial<Omit<Testimonial, 'id'>> }
    }
  }
}
