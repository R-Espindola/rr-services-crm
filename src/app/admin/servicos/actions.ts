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
