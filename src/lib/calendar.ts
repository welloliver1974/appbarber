/**
 * Gera conteúdo .ics (iCalendar RFC 5545) para download
 * Compatível com Google Calendar, iPhone Calendar, Outlook
 */

export interface AppointmentICSData {
  shop: { name: string; address?: string }
  barberName: string
  services: string[]
  startTime: Date // já em UTC
  endTime: Date // já em UTC
  totalPrice: number
  clientPhone: string
}

/**
 * Formata Date como string YYYYMMDDTHHMMSSZ (UTC)
 */
function formatICSTimestamp(date: Date): string {
  const d = new Date(date)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`
}

/**
 * Gera UID único baseado em timestamp + random
 */
function generateUID(): string {
  return `appbarber-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Gera o conteúdo do arquivo .ics (iCalendar)
 */
export function generateICS(data: AppointmentICSData): string {
  const { shop, barberName, services, startTime, endTime, totalPrice, clientPhone } = data

  const uid = generateUID()
  const dtStamp = formatICSTimestamp(new Date())
  const dtStart = formatICSTimestamp(startTime)
  const dtEnd = formatICSTimestamp(endTime)

  const serviceList = services.join(', ')
  const formattedPrice = totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const location = shop.address || 'Endereço não disponível'

  // Escapa caracteres especiais para iCalendar (linhas com \, ; , e newlines)
  const escapeICal = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AppBarber//Calendarium//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@appbarber.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICal(shop.name)} - ${escapeICal(serviceList)}`,
    `DESCRIPTION:Barbeiro: ${escapeICal(barberName)}\\nServiços: ${escapeICal(serviceList)}\\nValor: ${escapeICal(formattedPrice)}\\nWhatsApp: ${escapeICal(clientPhone)}`,
    `LOCATION:${escapeICal(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')

  return icsContent
}

/**
 * Dispara download do arquivo .ics no navegador
 */
export function downloadICS(icsContent: string, filename?: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `agendamento-${Date.now()}.ics`
  a.click()
  URL.revokeObjectURL(url)
}