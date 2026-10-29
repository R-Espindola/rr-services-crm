'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'

export type AssignableWorker = { user_id: string; display_name: string; active: boolean }
type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

async function getAdminClient() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false as const, error: 'Inicie sessão para continuar.' }

  const { data: profile, error: profileError } = await supabase.from('clients')
    .select('role').eq('auth_user_id', user.id).maybeSingle()
  if (profileError) return { success: false as const, error: 'Não foi possível validar as permissões.' }
  if (profile?.role !== 'admin') return { success: false as const, error: 'Apenas administradores podem gerir atribuições.' }
  return { success: true as const, supabase }
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
): Promise<ActionResult<{ orderId: string; workerUserId: string | null; workerName: string | null }>> {
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

    const { data: updated, error } = await auth.supabase.from('orders')
      .update({ worker_user_id: workerUserId }).eq('id', orderIdInput)
      .select('id, worker_user_id').maybeSingle()
    if (error) return { success: false, error: 'Não foi possível guardar a atribuição.' }
    if (!updated) return { success: false, error: 'Marcação não encontrada ou sem permissão para a alterar.' }

    revalidatePath('/admin')
    revalidatePath('/admin/servicos')
    return { success: true, data: { orderId: updated.id, workerUserId: updated.worker_user_id, workerName } }
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
}): Promise<ActionResult<{ count: number }>> {
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

    const { data, error } = await auth.supabase.rpc('admin_criar_agendamentos_recorrentes', {
      p_client_id: input.clientId,
      p_service_type: input.serviceType.trim(),
      p_start_date: input.date,
      p_start_time: input.time,
      p_total_amount: input.totalAmount,
      p_notes: notes as string | null,
      p_worker_user_id: input.workerUserId || null,
      p_frequency: frequency,
      p_occurrences: occurrences,
    })

    if (error) return { success: false, error: 'Não foi possível criar as marcações. Confirme os dados e tente novamente.' }
    const result = data as { count?: number } | null
    const count = result?.count
    if (typeof count !== 'number' || count < 1) return { success: false, error: 'A base de dados não confirmou as marcações criadas.' }
    revalidatePath('/admin/servicos')
    revalidatePath('/admin')
    return { success: true, data: { count } }
  } catch {
    return { success: false, error: 'Ocorreu um erro ao criar as marcações.' }
  }
}
