function normalizeMoneyValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0

  let normalized = value.trim().replace(/[\s\u00a0\u202f]/g, '').replace(/(?:EUR|€)/gi, '')
  if (!normalized) return 0

  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  if (comma !== -1 && dot !== -1) {
    const decimalSeparator = comma > dot ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? /\./g : /,/g
    normalized = normalized.replace(groupingSeparator, '')
    if (decimalSeparator === ',') normalized = normalized.replace(',', '.')
  } else if (comma !== -1) {
    normalized = normalized.replace(',', '.')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function toCents(value: unknown) {
  return Math.round(normalizeMoneyValue(value) * 100)
}

export function fromCents(cents: number) {
  return Number.isFinite(cents) ? Math.round(cents) / 100 : 0
}

export function sumCents(values: readonly unknown[]) {
  return values.reduce<number>((sum, value) => sum + toCents(value), 0)
}

export function percentageCents(amountCents: number, percentage: number) {
  const safeAmountCents = Number.isFinite(amountCents) ? Math.round(amountCents) : 0
  const safePercentage = Number.isFinite(percentage) ? percentage : 0
  return Math.round(safeAmountCents * safePercentage / 100)
}
