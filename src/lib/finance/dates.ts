export const FINANCE_TIME_ZONE = 'Europe/Lisbon'

export type FinanceDateRange = { start: string; endExclusive: string }

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: FINANCE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: FINANCE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function partsMap(formatter: Intl.DateTimeFormat, date: Date) {
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]))
}

function dateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError(`Data financeira inválida: ${value}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new RangeError(`Data financeira inválida: ${value}`)
  }
  return { year, month, day }
}

export function financeDateParts(value: string) {
  return parseDateKey(value)
}

export function isFinanceDateKey(value: string) {
  try {
    parseDateKey(value)
    return true
  } catch {
    return false
  }
}

export function financeDateForInstant(value: Date | string) {
  const instant = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Instante financeiro inválido.')
  const parts = partsMap(dateFormatter, instant)
  return dateKey(Number(parts.year), Number(parts.month), Number(parts.day))
}

export function financeToday(now = new Date()) {
  return financeDateForInstant(now)
}

export function addFinanceDays(value: string, days: number) {
  const { year, month, day } = parseDateKey(value)
  const calendarDate = new Date(Date.UTC(year, month - 1, day + days))
  return dateKey(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, calendarDate.getUTCDate())
}

export function financeDayDifference(start: string, end: string) {
  const a = parseDateKey(start)
  const b = parseDateKey(end)
  return (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000
}

export function financeDaysInMonth(value: string) {
  const { year, month } = parseDateKey(value)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function financeWeekRange(value: string): FinanceDateRange {
  const { year, month, day } = parseDateKey(value)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const start = addFinanceDays(value, weekday === 0 ? -6 : 1 - weekday)
  return { start, endExclusive: addFinanceDays(start, 7) }
}

export function financeMonthRange(value: string): FinanceDateRange {
  const { year, month } = parseDateKey(value)
  const nextMonthStart = new Date(Date.UTC(year, month, 1))
  return {
    start: dateKey(year, month, 1),
    endExclusive: dateKey(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth() + 1, 1),
  }
}

export function financeDateToUtcIso(value: string) {
  const { year, month, day } = parseDateKey(value)
  const targetWallTime = Date.UTC(year, month - 1, day)
  let instant = targetWallTime

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = partsMap(dateTimeFormatter, new Date(instant))
    const representedWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    const correction = targetWallTime - representedWallTime
    instant += correction
    if (correction === 0) break
  }

  return new Date(instant).toISOString()
}

export function formatFinanceDate(value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'short' }) {
  const { year, month, day } = parseDateKey(value)
  return new Intl.DateTimeFormat('pt-PT', { ...options, timeZone: FINANCE_TIME_ZONE })
    .format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function formatFinanceDateTime(value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }) {
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return 'Data indisponível'
  return new Intl.DateTimeFormat('pt-PT', { ...options, timeZone: FINANCE_TIME_ZONE }).format(instant)
}
