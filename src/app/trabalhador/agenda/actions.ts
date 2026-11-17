'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { buildBookingNotification, dispatchBookingNotification } from '@/lib/notifications'

const orderIdSchema = z.string().uuid()

export async function marcarDeslocacao(orderIdInput: unknown) {
  const parsed = orderIdSchema.safeParse(orderIdInput)
  if (!parsed.success) return { success: false as const, error: 'Agendamento inválido.' }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false as const, error: 'A sua sessão terminou.' }

  const { data, error } = await supabase.rpc('worker_mark_en_route', { p_order_id: parsed.data })
  if (error) return { success: false as const, error: 'Não foi possível atualizar o estado para “A caminho”.' }

  const { data: order } = await supabase.from('orders').select('client_id').eq('id', parsed.data).maybeSingle()
  if (order?.client_id) {
    await dispatchBookingNotification(buildBookingNotification('en_route', parsed.data, order.client_id))
  }

  revalidatePath('/trabalhador')
  revalidatePath('/trabalhador/agenda')
  return { success: true as const, data }
}
