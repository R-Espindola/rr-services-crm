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

const outgoingPattern =
  /\b(?:pagaste|voc[eê]\s+pagou|valor\s+gasto|gastaste|compra|voc[eê]\s+enviou|enviaste|transfer[eê]ncia\s+enviada|d[eé]bito|spent|paid|pagamento\s+com\s+cart[aã]o|card\s+payment|payment\s+with\s+card)\b/i
const incomingPattern =
  /\b(?:recebeste|voc[eê]\s+recebeu|pagamento\s+recebido|transfer[eê]ncia\s+recebida|reembolso|estorno|transfer\s+received|money\s+received|received|refund)\b/i
const cardBalancePattern = /Saldo\s+(?:em|de)\s+EUR:/i
const ignoredPattern =
  /\b(?:ganhe\s*€|recompensa|indicad[oa]|pagamento\s+recusado|rejeitad[oa]|declined|failed|insuficiente|c[oó]digo\s+de\s+verifica[cç][aã]o|c[aâ]mbio)\b/i
const amountPattern = /([+\-−])?\s*(?:(EUR|€)\s*)?(\d[\d\s.,]*\d|\d)\s*(EUR|€)?/giu

function stripBalanceAndNoise(text: string) {
  return text
    .replace(/Saldo\s+(?:em|de)\s+EUR:.*$/gi, '')
    .replace(/Toque para conferir\.?/gi, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
    .trim()
}

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

function extractParty(cleanText: string, cleanTitle: string, direction: 'expense' | 'income') {
  const pattern =
    direction === 'expense'
      ? /(?:\bno\(a\)|\b(?:em|para|at|to))\s+(.+?)\s*$/i
      : /\b(?:recebido\s+de|de|from)\s+([^.]+?)(?:\.|$)/i

  const match = cleanText.match(pattern)
  const rawParty =
    match?.[1] ??
    (direction === 'expense' && cleanTitle && !outgoingPattern.test(cleanTitle) ? cleanTitle : '')
  const party = rawParty.replace(/[\s.,;:!?…]+$/g, '').trim()
  return party ? party.slice(0, 160) : null
}

export function parseRevolutNotification(input: RevolutNotificationInput): ParsedRevolutNotification | null {
  if (!Number.isFinite(input.timestamp.getTime())) return null

  const hasCardBalanceFooter = cardBalancePattern.test(input.text)
  const cleanTitle = stripBalanceAndNoise(input.title)
  const cleanText = stripBalanceAndNoise(input.text)
  const content = `${cleanTitle}\n${cleanText}`

  if (ignoredPattern.test(content)) return null

  const extractedAmount = extractAmount(content)
  if (!extractedAmount) return null

  const direction =
    extractedAmount.sign === '+'
      ? 'income'
      : extractedAmount.sign === '-' || extractedAmount.sign === '−'
        ? 'expense'
        : incomingPattern.test(content)
          ? 'income'
          : outgoingPattern.test(content) || hasCardBalanceFooter
            ? 'expense'
            : null

  if (!direction) return null

  const amount = direction === 'income' ? extractedAmount.amount : -extractedAmount.amount
  const party = extractParty(cleanText, cleanTitle, direction)

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
    return 'combustivel'
  }

  if (/\b(continente|pingo doce|lidl|aldi|mercadona|auchan|intermarche|minipreco|spar|carrefour)\b/.test(merchant)) {
    return 'supermercado'
  }

  if (/\b(adobe|microsoft|google workspace|apple|spotify|netflix|dropbox|github|software|saas)\b/.test(merchant)) {
    return 'tecnologia'
  }

  if (/\b(edp|endesa|iberdrola|meo|nos|vodafone|rent|renda|condominio)\b/.test(merchant)) {
    return 'habitacao'
  }

  if (/\b(produto|material|limpeza|leroy merlin|bricomarche)\b/.test(merchant)) {
    return 'produtos'
  }

  return 'outros'
}