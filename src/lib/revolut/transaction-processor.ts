import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { categorizeRevolutNotification, type ParsedRevolutNotification } from './notification-parser'

const processResultSchema = z.object({
  inserted: z.boolean(),
  reconciled: z.boolean(),
})

export function createRevolutTransactionId(notification: ParsedRevolutNotification) {
  const minuteBucket = Math.floor(notification.timestamp.getTime() / 60_000)
  const amount = notification.amount.toFixed(2)
  const merchant = (notification.merchantName ?? notification.counterpartyName ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT')

  return createHash('sha256')
    .update(`${minuteBucket}|${amount}|${merchant}`, 'utf8')
    .digest('hex')
}

export async function processRevolutNotification(
  supabase: SupabaseClient,
  notification: ParsedRevolutNotification,
  title: string,
  text: string,
) {
  const { data, error } = await supabase.rpc('process_revolut_notification', {
    p_bank_tx_id: createRevolutTransactionId(notification),
    p_title: title,
    p_notification_text: text,
    p_amount: notification.amount,
    p_direction: notification.direction,
    p_merchant_name: notification.merchantName,
    p_counterparty_name: notification.counterpartyName,
    p_transaction_at: notification.timestamp.toISOString(),
    p_category: categorizeRevolutNotification(notification),
  })

  if (error) throw new Error(`Failed to process Revolut notification: ${error.message}`)
  return processResultSchema.parse(data)
}
