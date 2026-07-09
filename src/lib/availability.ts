import { supabase } from './supabase'
import { formatTime, getUTC3DayOfWeek } from './timezone'
import type { BarberAvailability } from '@/types/database'

export function generateTimeSlots(start: string, end: string, duration: number): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const endMin = eh * 60 + em

  while (cur + duration <= endMin) {
    const h = Math.floor(cur / 60)
    const m = cur % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    cur += 30
  }
  return slots
}

export function slotsOverlap(
  s1: string, e1: string,
  s2: string, e2: string,
): boolean {
  return s1 < e2 && s2 < e1
}

export async function getAvailableSlots(
  barberId: string,
  dateStr: string,
  serviceDuration: number,
  excludeAppointmentId?: string,
): Promise<string[]> {
  const dayOfWeek = getUTC3DayOfWeek(dateStr)

  const { data: avail } = await supabase
    .from('barber_availability')
    .select('*')
    .eq('barber_id', barberId)
    .eq('day_of_week', dayOfWeek)

  const availList = (avail as BarberAvailability[]) ?? []
  if (availList.length === 0) return []

  const dayStart = new Date(dateStr + 'T00:00:00')
  const dayEnd = new Date(dateStr + 'T23:59:59')

  let query = supabase
    .from('appointments')
    .select('start_time, end_time, services(buffer_minutes)')
    .eq('barber_id', barberId)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .neq('status', 'cancelled')

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId)
  }

  const { data: booked } = await query
  const bookedSlots = (booked ?? []).map((b: any) => {
    const start = formatTime(b.start_time)
    const end = formatTime(b.end_time)
    const buffer = b.services?.buffer_minutes ?? 0
    const endWithBuffer = addMinutes(end, buffer)
    return {
      start,
      end: endWithBuffer,
    }
  })

  const allSlots: string[] = []
  for (const a of availList) {
    const slots = generateTimeSlots(a.start_time.slice(0, 5), a.end_time.slice(0, 5), serviceDuration)
    allSlots.push(...slots)
  }

  return allSlots.filter((slot) => {
    const slotEnd = addMinutes(slot, serviceDuration)
    return !bookedSlots.some((b) => slotsOverlap(slot, slotEnd, b.start, b.end))
  })
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}
