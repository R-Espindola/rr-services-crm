'use server'

import 'server-only'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export type WorkerRecord = {
  user_id: string
  display_name: string
  email: string | null
  phone: string | null
  job_title: string
  active: boolean
  created_at: string
  total_month_minutes: number
}

type ActionResult<T = undefined> = { success: true; data?: T; temporaryPassword?: string } | { success: false; error: string }

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Server Supabase configuration is missing')
  return createSupabaseAdmin(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return { ok: false, error: 'A sua sessão terminou. Inicie sessão novamente.' }

  const { data: profile, error: profileError } = await authClient.from('clients')
    .select('role').eq('auth_user_id', user.id).maybeSingle()
  if (profileError) return { ok: false, error: 'Não foi possível validar as permissões.' }
  if (profile?.role !== 'admin') return { ok: false, error: 'Não tem autorização para gerir funcionários.' }
  return { ok: true, userId: user.id }
}

function cleanText(value: unknown, min: number, max: number) {
  if (typeof value !== 'string') return null
  const result = value.trim()
  return result.length >= min && result.length <= max ? result : null
}

function validEmail(value: unknown) {
  const email = cleanText(value, 3, 254)?.toLowerCase()
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function validPhone(value: unknown) {
  const phone = cleanText(value, 7, 30)
  const digitCount = phone?.replace(/\D/g, '').length ?? 0
  return phone && /^[+\d\s().-]+$/.test(phone) && digitCount >= 7 && digitCount <= 15 ? phone : null
}

function currentLisbonMonth() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

function lisbonMidnightUtc(year: number, monthIndex: number) {
  const target = Date.UTC(year, monthIndex, 1)
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  let guess = target
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(guess))
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
    const localAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
    guess = target - (localAsUtc - guess)
  }
  return new Date(guess).toISOString()
}

function monthBounds(monthInput: unknown) {
  const month = typeof monthInput === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthInput) ? monthInput : currentLisbonMonth()
  const [year, monthNumber] = month.split('-').map(Number)
  return {
    month,
    start: lisbonMidnightUtc(year, monthNumber - 1),
    end: lisbonMidnightUtc(year, monthNumber),
  }
}

export async function listWorkers(monthInput?: string): Promise<ActionResult<WorkerRecord[]>> {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return { success: false, error: auth.error }
    const admin = adminClient()
    const { data, error } = await admin.from('worker_profiles')
      .select('user_id, display_name, email, phone, job_title, active, created_at')
      .order('display_name', { ascending: true })
    if (error) return { success: false, error: 'Não foi possível carregar a equipa.' }

    const bounds = monthBounds(monthInput)
    const minutesByWorker = new Map<string, number>()
    let offset = 0
    while (true) {
      const { data: orders, error: ordersError } = await admin.from('orders')
        .select('worker_user_id, duration_minutes, started_at, completed_at, paused_duration_seconds')
        .eq('status', 'completed')
        .not('worker_user_id', 'is', null)
        .not('completed_at', 'is', null)
        .gte('completed_at', bounds.start)
        .lt('completed_at', bounds.end)
        .order('completed_at', { ascending: true })
        .order('worker_user_id', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + 999)
      if (ordersError) return { success: false, error: 'Não foi possível calcular as horas da equipa.' }
      for (const order of orders ?? []) {
        if (!order.worker_user_id) continue
        const minutes = order.duration_minutes ?? (order.started_at && order.completed_at
          ? Math.max(0, Math.floor((new Date(order.completed_at).getTime() - new Date(order.started_at).getTime() - (order.paused_duration_seconds ?? 0) * 1000) / 60_000))
          : 0)
        minutesByWorker.set(order.worker_user_id, (minutesByWorker.get(order.worker_user_id) ?? 0) + minutes)
      }
      if (!orders || orders.length < 1000) break
      offset += 1000
    }

    const workers = (data ?? []).map((worker) => ({
      ...worker,
      total_month_minutes: minutesByWorker.get(worker.user_id) ?? 0,
    })) as WorkerRecord[]
    return { success: true, data: workers }
  } catch {
    return { success: false, error: 'Não foi possível carregar a equipa.' }
  }
}

export async function createWorker(input: {
  name: unknown; email: unknown; phone: unknown; jobTitle: unknown; password: unknown; generatePassword: unknown
}): Promise<ActionResult<{ worker: WorkerRecord }>> {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return { success: false, error: auth.error }
    const name = cleanText(input.name, 2, 120)
    const email = validEmail(input.email)
    const phone = validPhone(input.phone)
    const jobTitle = cleanText(input.jobTitle, 1, 80)
    const generatePassword = input.generatePassword === true
    const suppliedPassword = typeof input.password === 'string' ? input.password : ''
    if (!name || !email || !phone || !jobTitle || (!generatePassword && suppliedPassword.length < 12) || suppliedPassword.length > 128) {
      return { success: false, error: 'Verifique os campos. A palavra-passe deve ter pelo menos 12 caracteres.' }
    }

    const temporaryPassword = generatePassword ? randomBytes(24).toString('base64url') : suppliedPassword
    const admin = adminClient()
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { name },
    })
    if (createError || !created.user) {
      return { success: false, error: 'Não foi possível criar a conta. Verifique se o e-mail já está registado.' }
    }

    const { data: worker, error: insertError } = await admin.from('worker_profiles').insert({
      user_id: created.user.id,
      display_name: name,
      email,
      phone,
      job_title: jobTitle,
      active: true,
    }).select('user_id, display_name, email, phone, job_title, active, created_at').single()

    if (insertError || !worker) {
      // Compensate if profile creation fails so an orphan Auth account is not left behind.
      await admin.auth.admin.deleteUser(created.user.id)
      return { success: false, error: 'A conta foi revertida porque não foi possível guardar o perfil do funcionário.' }
    }

    return {
      success: true,
      data: { worker: worker as WorkerRecord },
      temporaryPassword: generatePassword ? temporaryPassword : undefined,
    }
  } catch {
    return { success: false, error: 'Não foi possível criar o funcionário.' }
  }
}

export async function updateWorker(input: {
  userId: unknown; name: unknown; email: unknown; phone: unknown; jobTitle: unknown
}): Promise<ActionResult<{ worker: WorkerRecord }>> {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return { success: false, error: auth.error }
    const userId = cleanText(input.userId, 36, 36)
    const name = cleanText(input.name, 2, 120)
    const email = validEmail(input.email)
    const phone = validPhone(input.phone)
    const jobTitle = cleanText(input.jobTitle, 1, 80)
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || !name || !email || !phone || !jobTitle) {
      return { success: false, error: 'Verifique os dados do funcionário.' }
    }

    const admin = adminClient()
    const { data: existing, error: lookupError } = await admin.from('worker_profiles')
      .select('email').eq('user_id', userId).maybeSingle()
    if (lookupError || !existing) return { success: false, error: 'Funcionário não encontrado.' }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: { name },
    })
    if (authUpdateError) return { success: false, error: 'Não foi possível atualizar a conta Auth. Verifique se o e-mail já está registado.' }

    const { data: worker, error: updateError } = await admin.from('worker_profiles').update({
      display_name: name, email, phone, job_title: jobTitle,
    }).eq('user_id', userId)
      .select('user_id, display_name, email, phone, job_title, active, created_at').single()

    if (updateError || !worker) {
      // Keep Auth and the directory aligned if the profile update fails.
      if (existing.email) await admin.auth.admin.updateUserById(userId, { email: existing.email })
      return { success: false, error: 'Não foi possível guardar as alterações do funcionário.' }
    }
    return { success: true, data: { worker: worker as WorkerRecord } }
  } catch {
    return { success: false, error: 'Não foi possível atualizar o funcionário.' }
  }
}

export async function setWorkerActive(userIdInput: unknown, active: unknown): Promise<ActionResult<{ userId: string; active: boolean }>> {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return { success: false, error: auth.error }
    const userId = cleanText(userIdInput, 36, 36)
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || typeof active !== 'boolean') {
      return { success: false, error: 'Pedido inválido.' }
    }
    const { data, error } = await adminClient().from('worker_profiles').update({ active })
      .eq('user_id', userId).select('user_id, active').maybeSingle()
    if (error || !data) return { success: false, error: 'Não foi possível atualizar o estado do funcionário.' }
    return { success: true, data: { userId: data.user_id, active: data.active } }
  } catch {
    return { success: false, error: 'Não foi possível atualizar o estado do funcionário.' }
  }
}

export async function removeWorker(userIdInput: unknown): Promise<ActionResult<{ userId: string }>> {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return { success: false, error: auth.error }
    const userId = cleanText(userIdInput, 36, 36)
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return { success: false, error: 'Pedido inválido.' }
    if (userId === auth.userId) return { success: false, error: 'Não pode remover a sua própria conta de administrador.' }

    // Deleting the Auth account cascades to worker_profiles; order assignments are set null by the FK.
    const admin = adminClient()
    const { data: worker, error: lookupError } = await admin.from('worker_profiles')
      .select('user_id').eq('user_id', userId).maybeSingle()
    if (lookupError || !worker) return { success: false, error: 'Funcionário não encontrado.' }
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return { success: false, error: 'Não foi possível remover o funcionário.' }
    return { success: true, data: { userId } }
  } catch {
    return { success: false, error: 'Não foi possível remover o funcionário.' }
  }
}
