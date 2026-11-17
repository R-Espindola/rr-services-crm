'use server'

import { revalidatePath } from 'next/cache'
import { getAdminSession } from '@/lib/admin-auth'
import { sendWorkerPush } from '@/lib/worker-push-server'
import { z } from 'zod'
import { buildBookingNotification, dispatchBookingNotification } from '@/lib/notifications'

export type AssignableWorker = { user_id: string; display_name: string; active: boolean }
type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

async function getAdminClient() {
  const session = await getAdminSession()
  if (!session.success) return { success: false as const, error: session.error }
  return { success: true as const, supabase: session.supabase }
}

export async function listAssignableWorkers(): Promise<ActionResult<AssignableWorker[]>> {
  try {
    const auth = await getAdminClient()
    if (!auth.success) return auth
    const { data, error } = await auth.supabase.from('worker_profiles')
      .select('user_id, display_name, active').order('display_name', { ascending: true })
    if (error) return { success: false, error: 'Não foi possível carregar os funcionários.' }
    return { success: true, data: (data ?? []) as AssignableWorker[] }
  } catch {
    return { success: false, error: 'Não foi possível carregar os funcionários.' }
  }
}

export async function atribuirFuncionarioAMarcacao(
  orderIdInput: unknown,
  workerUserIdInput: unknown,
): Promise<ActionResult<{ orderId: string; workerUserId: string | null; workerName: string | null; notificationWarning?: string }>> {
  try {
    const auth = await getAdminClient()
    if (!auth.success) return auth

    if (typeof orderIdInput !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderIdInput)) {
      return { success: false, error: 'Marcação inválida.' }
    }
    const workerUserId = workerUserIdInput === '' || workerUserIdInput === null ? null : workerUserIdInput
    if (workerUserId !== null && (typeof workerUserId !== 'string' || !/^[0-9a-f-]{36}$/i.test(workerUserId))) {
      return { success: false, error: 'Funcionário inválido.' }
    }

    let workerName: string | null = null
    if (workerUserId) {
      const { data: worker, error: workerError } = await auth.supabase.from('worker_profiles')
        .select('display_name, active').eq('user_id', workerUserId).maybeSingle()
      if (workerError) return { success: false, error: 'Não foi possível validar o funcionário.' }
      if (!worker?.active) return { success: false, error: 'Escolha um funcionário ativo.' }
      workerName = worker.display_name
    }

    const { data: previousOrder, error: previousOrderError } = await auth.supabase.from('orders')
      .select('assigned_worker_id, worker_user_id').eq('id', orderIdInput).maybeSingle()
    if (previousOrderError) return { success: false, error: 'Não foi possível validar a marcação.' }
    if (!previousOrder) return { success: false, error: 'Marcação não encontrada.' }

    const { data: updated, error } = await auth.supabase.from('orders')
      .update({ assigned_worker_id: workerUserId }).eq('id', orderIdInput)
      .select('id, assigned_worker_id, worker_user_id').maybeSingle()
    if (error) return { success: false, error: 'Não foi possível guardar a atribuição.' }
    if (!updated) return { success: false, error: 'Marcação não encontrada ou sem permissão para a alterar.' }

    let notificationWarning: string | undefined
    if ((previousOrder.assigned_worker_id ?? previousOrder.worker_user_id) !== (updated.assigned_worker_id ?? updated.worker_user_id)) {
      const notifications: Array<{ workerId: string; title: string; body: string }> = []
      if (previousOrder.assigned_worker_id ?? previousOrder.worker_user_id) {
        notifications.push({
          workerId: previousOrder.assigned_worker_id ?? previousOrder.worker_user_id,
          title: 'Limpeza removida da agenda',
          body: 'Uma limpeza foi removida da sua agenda.',
        })
      }
      if (updated.assigned_worker_id ?? updated.worker_user_id) {
        notifications.push({
          workerId: updated.assigned_worker_id ?? updated.worker_user_id,
          title: 'Nova limpeza na agenda',
          body: 'Foi-lhe atribuída uma limpeza. Consulte a agenda para ver os detalhes.',
        })
      }
      notificationWarning = await notifyWorkers(notifications)
    }

    revalidatePath('/admin')
    revalidatePath('/admin/servicos')
    return {
      success: true,
      data: { orderId: updated.id, workerUserId: updated.assigned_worker_id ?? updated.worker_user_id, workerName, notificationWarning },
    }
  } catch {
    return { success: false, error: 'Ocorreu um erro ao guardar a atribuição.' }
  }
}

type Recurrence = 'once' | 'weekly' | 'biweekly'

export async function agendarLimpezasRecorrentes(input: {
  clientId: unknown
  serviceType: unknown
  date: unknown
  time: unknown
  totalAmount: unknown
  notes: unknown
  workerUserId: unknown
  frequency: unknown
  occurrences: unknown
}): Promise<ActionResult<{ count: number; notificationWarning?: string }>> {
  try {
    const auth = await getAdminClient()
    if (!auth.success) return auth

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const validDate = typeof input.date === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      && !Number.isNaN(Date.parse(`${input.date}T00:00:00Z`))
      && new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) === input.date
    const validTime = typeof input.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)
    const frequency = input.frequency as Recurrence
    const occurrences = input.occurrences
    const validFrequency = frequency === 'once' || frequency === 'weekly' || frequency === 'biweekly'
    const validOccurrences = frequency === 'once'
      ? occurrences === 1
      : typeof occurrences === 'number' && Number.isInteger(occurrences) && occurrences >= 2 && occurrences <= 6
    const notes = input.notes === null || input.notes === '' ? null : input.notes

    if (typeof input.clientId !== 'string' || !uuidPattern.test(input.clientId)
        || typeof input.serviceType !== 'string' || input.serviceType.trim().length < 1 || input.serviceType.length > 200
        || !validDate || !validTime
        || typeof input.totalAmount !== 'number' || !Number.isFinite(input.totalAmount) || input.totalAmount < 0
        || (notes !== null && (typeof notes !== 'string' || notes.length > 2000))
        || (input.workerUserId !== null && input.workerUserId !== '' && (typeof input.workerUserId !== 'string' || !uuidPattern.test(input.workerUserId)))
        || !validFrequency || !validOccurrences) {
      return { success: false, error: 'Verifique os dados da marcação e da recorrência.' }
    }

    const workerUserId = input.workerUserId === '' ? null : input.workerUserId
    const { data, error } = await auth.supabase.rpc('admin_criar_agendamentos_recorrentes', {
      p_client_id: input.clientId,
      p_service_type: input.serviceType.trim(),
      p_start_date: input.date,
      p_start_time: input.time,
      p_total_amount: input.totalAmount,
      p_notes: notes as string | null,
      p_worker_user_id: workerUserId || null,
      p_frequency: frequency,
      p_occurrences: occurrences,
    })

    if (error) return { success: false, error: 'Não foi possível criar as marcações. Confirme os dados e tente novamente.' }
    const result = data as { count?: number } | null
    const count = result?.count
    if (typeof count !== 'number' || count < 1) return { success: false, error: 'A base de dados não confirmou as marcações criadas.' }
    const push = typeof workerUserId === 'string'
      ? await sendWorkerPush(workerUserId, {
        title: 'Novas limpezas na agenda',
        body: `Foram-lhe atribuídas ${count} ${count === 1 ? 'limpeza' : 'limpezas'}. Consulte a agenda para ver os detalhes.`,
        url: '/trabalhador/agenda',
      })
      : { sent: 0 }
    revalidatePath('/admin/servicos')
    revalidatePath('/admin')
    return { success: true, data: { count, notificationWarning: push.warning } }
  } catch {
    return { success: false, error: 'Ocorreu um erro ao criar as marcações.' }
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const orderStatuses = ['pending', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled'] as const
const paymentStatuses = ['pending', 'paid'] as const

type OrderStatus = (typeof orderStatuses)[number]
type PaymentStatus = (typeof paymentStatuses)[number]

async function notifyWorkers(
  notifications: Array<{ workerId: string; title: string; body: string }>,
) {
  const results = await Promise.all(notifications.map(({ workerId, title, body }) =>
    sendWorkerPush(workerId, { title, body, url: '/trabalhador/agenda' }),
  ))
  return results.find((result) => result.warning)?.warning
}

export async function updateBooking(input: {
  orderId: unknown
  scheduledDate: unknown
  status: unknown
  paymentStatus: unknown
  workerUserId: unknown
}): Promise<ActionResult<{ notificationWarning?: string }>> {
  try {
    const auth = await getAdminClient()
    if (!auth.success) return auth

    if (typeof input.orderId !== 'string' || !uuidPattern.test(input.orderId)
        || typeof input.scheduledDate !== 'string'
        || Number.isNaN(Date.parse(input.scheduledDate))
        || typeof input.status !== 'string' || !orderStatuses.includes(input.status as OrderStatus)
        || typeof input.paymentStatus !== 'string' || !paymentStatuses.includes(input.paymentStatus as PaymentStatus)
        || (input.workerUserId !== null && input.workerUserId !== ''
          && (typeof input.workerUserId !== 'string' || !uuidPattern.test(input.workerUserId)))) {
      return { success: false, error: 'Verifique os dados da marcação.' }
    }

    const workerUserId = input.workerUserId === '' ? null : input.workerUserId as string | null
    if (workerUserId) {
      const { data: worker, error: workerError } = await auth.supabase.from('worker_profiles')
        .select('active').eq('user_id', workerUserId).maybeSingle()
      if (workerError) return { success: false, error: 'Não foi possível validar o trabalhador.' }
      if (!worker?.active) return { success: false, error: 'Escolha um trabalhador ativo.' }
    }

    const { data: previous, error: lookupError } = await auth.supabase.from('orders')
      .select('worker_user_id, scheduled_date, status').eq('id', input.orderId).maybeSingle()
    if (lookupError) return { success: false, error: 'Não foi possível carregar a marcação.' }
    if (!previous) return { success: false, error: 'Marcação não encontrada.' }

    const { data: updated, error: updateError } = await auth.supabase.from('orders')
      .update({
        scheduled_date: input.scheduledDate,
        status: input.status,
        payment_status: input.paymentStatus,
        worker_user_id: workerUserId,
      })
      .eq('id', input.orderId)
      .select('id')
      .maybeSingle()
    if (updateError) return { success: false, error: 'Não foi possível atualizar a marcação.' }
    if (!updated) return { success: false, error: 'Marcação não encontrada ou sem permissão para a alterar.' }

    const notifications: Array<{ workerId: string; title: string; body: string }> = []
    const workerChanged = previous.worker_user_id !== workerUserId
    if (workerChanged && previous.worker_user_id) {
      notifications.push({
        workerId: previous.worker_user_id,
        title: 'Limpeza removida da agenda',
        body: 'Uma limpeza foi removida da sua agenda.',
      })
    }
    if (workerChanged && workerUserId && input.status !== 'cancelled') {
      notifications.push({
        workerId: workerUserId,
        title: 'Nova limpeza na agenda',
        body: 'Foi-lhe atribuída uma limpeza. Consulte a agenda para ver os detalhes.',
      })
    }
    if (!workerChanged && workerUserId
        && (previous.scheduled_date !== input.scheduledDate || previous.status !== input.status)) {
      notifications.push({
        workerId: workerUserId,
        title: input.status === 'cancelled' ? 'Limpeza cancelada' : 'Agenda atualizada',
        body: input.status === 'cancelled'
          ? 'Uma limpeza agendada foi cancelada.'
          : 'O horário ou estado de uma limpeza foi alterado. Consulte a agenda.',
      })
    }
    const notificationWarning = await notifyWorkers(notifications)
    revalidatePath('/admin')
    revalidatePath('/admin/servicos')
    revalidatePath('/trabalhador/agenda')
    return { success: true, data: { notificationWarning } }
  } catch {
    return { success: false, error: 'Ocorreu um erro ao atualizar a marcação.' }
  }
}

export async function updateOrderStatus(
  orderId: unknown,
  status: unknown,
): Promise<ActionResult<{ notificationWarning?: string }>> {
  try {
    const auth = await getAdminClient()
    if (!auth.success) return auth
    const parsed = z.object({ orderId: z.string().uuid(), status: z.enum(orderStatuses) }).safeParse({ orderId, status })
    if (!parsed.success) {
      return { success: false, error: 'Estado da marcação inválido.' }
    }
    const validatedOrderId = parsed.data.orderId
    const validatedStatus = parsed.data.status

    const { data: previous, error: lookupError } = await auth.supabase.from('orders')
      .select('worker_user_id, status').eq('id', validatedOrderId).maybeSingle()
    if (lookupError) return { success: false, error: 'Não foi possível carregar a marcação.' }
    if (!previous) return { success: false, error: 'Marcação não encontrada.' }

    const { error: updateError } = await auth.supabase.from('orders').update({ status: validatedStatus })
      .eq('id', validatedOrderId)
    if (updateError) return { success: false, error: 'Não foi possível atualizar o estado.' }

    const notificationWarning = previous.worker_user_id && previous.status !== validatedStatus
      ? await notifyWorkers([{
        workerId: previous.worker_user_id,
        title: validatedStatus === 'cancelled' ? 'Limpeza cancelada' : 'Estado da limpeza atualizado',
        body: validatedStatus === 'cancelled'
          ? 'Uma limpeza agendada foi cancelada.'
          : 'O estado de uma limpeza foi alterado. Consulte a agenda.',
      }])
      : undefined
    if (previous.status !== validatedStatus && validatedStatus === 'en_route') {
      const { data: order } = await auth.supabase.from('orders').select('client_id').eq('id', validatedOrderId).maybeSingle()
      if (order?.client_id) await dispatchBookingNotification(buildBookingNotification('en_route', validatedOrderId, order.client_id))
    }
    revalidatePath('/admin/servicos')
    revalidatePath('/trabalhador/agenda')
    return { success: true, data: { notificationWarning } }
  } catch {
    return { success: false, error: 'Ocorreu um erro ao atualizar o estado.' }
  }
}

export async function deleteBooking(
  orderId: unknown,
): Promise<ActionResult<{ notificationWarning?: string }>> {
  try {
    const auth = await getAdminClient()
    if (!auth.success) return auth
    if (typeof orderId !== 'string' || !uuidPattern.test(orderId)) {
      return { success: false, error: 'Marcação inválida.' }
    }

    const { data: previous, error: lookupError } = await auth.supabase.from('orders')
      .select('worker_user_id').eq('id', orderId).maybeSingle()
    if (lookupError) return { success: false, error: 'Não foi possível carregar a marcação.' }
    if (!previous) return { success: false, error: 'Marcação não encontrada.' }

    const { error: deleteError } = await auth.supabase.from('orders').delete().eq('id', orderId)
    if (deleteError) return { success: false, error: 'Não foi possível eliminar a marcação.' }

    const notificationWarning = previous.worker_user_id
      ? await notifyWorkers([{
        workerId: previous.worker_user_id,
        title: 'Limpeza removida da agenda',
        body: 'Uma limpeza foi removida da sua agenda.',
      }])
      : undefined
    revalidatePath('/admin/servicos')
    revalidatePath('/trabalhador/agenda')
    return { success: true, data: { notificationWarning } }
  } catch {
    return { success: false, error: 'Ocorreu um erro ao eliminar a marcação.' }
  }
}
