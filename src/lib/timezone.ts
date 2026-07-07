const TIMEZONE = 'America/Sao_Paulo'

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: TIMEZONE })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TIMEZONE })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })
}

export function formatTimeRaw(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function toUTC3(date: Date): Date {
  const offset = date.getTimezoneOffset()
  const brtOffset = -180
  const diff = brtOffset + offset
  return new Date(date.getTime() + diff * 60000)
}
