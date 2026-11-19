export type RevolutNotificationInput = {
  title: string
  text: string
  timestamp: Date
}

export type ParsedRevolutNotification = {
  direction: 'expense' | 'income'
  amount: number
  merchantName: string | null
  counterpartyName: string | null
  timestamp: Date
}

const outgoingPattern = /\b(?:pagaste|spent|paid|pagamento\s+com\s+cart[aã]o|card\s+payment|payment\s+with\s+card)\b/i
const incomingPattern = /\b(?:recebeste|received|transfer[eê]ncia\s+recebida|transfer\s+received|money\s+received)\b/i
const amountPattern = /([+\-−])?\s*(?:(EUR|€)\s*)?(\d[\d\s.,]*\d|\d)\s*(EUR|€)?/giu

function parseAmount(value: string) {
  const normalized = value.replace(/\s/g, '')
  const lastComma = normalized.lastIndexOf(',')
  const lastDot = normalized.lastIndexOf('.')
  let decimalValue: string

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','
    decimalValue = normalized.split(groupingSeparator).join('')
    if (decimalSeparator === ',') decimalValue = decimalValue.replace(',', '.')
    else decimalValue = decimalValue.replace(/,/g, '')
  } else if (lastComma !== -1 || lastDot !== -1) {
    const separator = lastComma !== -1 ? ',' : '.'
    const parts = normalized.split(separator)
    const decimals = parts[parts.length - 1]
    if (decimals.length > 0 && decimals.length <= 2) {
      decimalValue = `${parts.slice(0, -1).join('')}.${decimals}`
    } else {
      decimalValue = parts.join('')
    }
  } else {
    decimalValue = normalized
  }

  const amount = Number(decimalValue)
  return Number.isFinite(amount) && amount > 0 && amount <= 9_999_999_999.99 ? amount : null
}

function extractAmount(text: string) {
  amountPattern.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = amountPattern.exec(text)) !== null) {
    if (!match[2] && !match[4]) continue
    const amount = parseAmount(match[3])
    if (amount !== null) return { amount, sign: match[1] ?? null }
  }

  return null
}

function extractParty(text: string, direction: 'expense' | 'income') {
  const pattern = direction === 'expense' ? /\b(?:em|at)\s+(.+?)\s*$/i : /\b(?:de|from)\s+(.+?)\s*$/i
  const match = text.match(pattern)
  const party = match?.[1]?.replace(/[\s.,;:!?]+$/, '').trim()
  return party ? party.slice(0, 160) : null
}

export function parseRevolutNotification(input: RevolutNotificationInput): ParsedRevolutNotification | null {
  if (!Number.isFinite(input.timestamp.getTime())) return null

  const content = `${input.title}\n${input.text}`
  const extractedAmount = extractAmount(content)
  if (!extractedAmount) return null

  const direction = extractedAmount.sign === '+'
    ? 'income'
    : extractedAmount.sign === '-' || extractedAmount.sign === '−'
      ? 'expense'
      : incomingPattern.test(content)
        ? 'income'
        : outgoingPattern.test(content)
          ? 'expense'
          : null

  if (!direction) return null

  const amount = direction === 'income' ? extractedAmount.amount : -extractedAmount.amount
  const party = extractParty(input.text, direction)

  return {
    direction,
    amount,
    merchantName: direction === 'expense' ? party : null,
    counterpartyName: direction === 'income' ? party : null,
    timestamp: input.timestamp,
  }
}

export function categorizeRevolutNotification(notification: ParsedRevolutNotification) {
  if (notification.direction === 'income') return 'Transferência recebida'

  const merchant = notification.merchantName?.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() ?? ''

  if (/\b(galp|bp|repsol|cepsa|shell|prio|moeve|petro(l|gal)|fuel)\b/.test(merchant)) {
    return 'Combustível'
  }

  if (/\b(continente|pingo doce|lidl|aldi|mercadona|auchan|intermarche|minipreco|spar|carrefour)\b/.test(merchant)) {
    return 'Supermercado'
  }

  return 'Produtos'
}
