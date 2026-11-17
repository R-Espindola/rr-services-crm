'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

const uuidSchema = z.string().uuid()
const dateSchema = z.string().datetime({ offset: true })
const propertySchema = z.object({
  id: uuidSchema.optional(),
  label: z.string().trim().min(1).max(120),
  streetAddress: z.string().trim().min(1).max(300),
  postalCode: z.string().regex(/^\d{4}-\d{3}$/, 'Indique um código postal válido, por exemplo 2900-000.'),
  city: z.string().trim().min(1).max(120),
  referenceNotes: z.string().max(1000).default(''),
  accessInstructions: z.string().max(2000).default(''),
  cleaningNotes: z.string().max(2000).default(''),
  companyProvidesSupplies: z.boolean().default(true),
})

type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: string }

async function getClientContext() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false as const, error: 'A sua sessão terminou. Inicie sessão novamente.' }

  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (error || !client) return { success: false as const, error: 'Perfil de cliente não encontrado.' }

  return { success: true as const, supabase, user, clientId: client.id }
}

export async function reagendarMarcacao(input: unknown): Promise<ActionResult<{ orderId: string; scheduledDate: string }>> {
  const parsed = z.object({ orderId: uuidSchema, scheduledDate: dateSchema }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Indique uma data e hora válidas.' }

  const context = await getClientContext()
  if (!context.success) return context

  const newDate = new Date(parsed.data.scheduledDate)
  if (newDate.getTime() <= Date.now()) return { success: false, error: 'Escolha uma data futura.' }

  const { data, error } = await context.supabase.rpc('client_reschedule_order', {
    p_order_id: parsed.data.orderId,
    p_scheduled_date: newDate.toISOString(),
  })
  if (error) return { success: false, error: error.message.includes('24 hours') ? 'As alterações devem ser feitas com pelo menos 24 horas de antecedência.' : 'Não foi possível reagendar a marcação.' }

  revalidatePath('/cliente')
  revalidatePath('/cliente/pedidos')
  return { success: true, data: { orderId: parsed.data.orderId, scheduledDate: newDate.toISOString() } }
}

export async function cancelarMarcacao(input: unknown): Promise<ActionResult<{ orderId: string; lateFeeApplied: boolean }>> {
  const parsed = z.object({
    orderId: uuidSchema,
    confirmLateCancellation: z.boolean().default(false),
    reason: z.string().trim().max(1000).default('Cancelamento solicitado pelo cliente'),
  }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados de cancelamento inválidos.' }

  const context = await getClientContext()
  if (!context.success) return context

  const { data, error } = await context.supabase.rpc('client_cancel_order', {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
    p_confirm_late: parsed.data.confirmLateCancellation,
  })
  if (error) {
    if (error.message.includes('late cancellation confirmation required')) {
      return { success: false, code: 'LATE_CANCELLATION', error: 'Esta marcação começa dentro de 24 horas. Poderá existir uma taxa de cancelamento tardio.' }
    }
    return { success: false, error: 'Não foi possível cancelar a marcação.' }
  }

  revalidatePath('/cliente')
  revalidatePath('/cliente/pedidos')
  return { success: true, data: { orderId: parsed.data.orderId, lateFeeApplied: Boolean((data as { late_fee_applied?: boolean } | null)?.late_fee_applied) } }
}

export async function guardarMorada(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = propertySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Verifique os dados da morada.' }

  const context = await getClientContext()
  if (!context.success) return context

  const values = {
    client_id: context.clientId,
    label: parsed.data.label,
    street_address: parsed.data.streetAddress,
    postal_code: parsed.data.postalCode,
    city: parsed.data.city,
    reference_notes: parsed.data.referenceNotes,
    access_instructions: parsed.data.accessInstructions,
    cleaning_notes: parsed.data.cleaningNotes,
    company_provides_supplies: parsed.data.companyProvidesSupplies,
    updated_at: new Date().toISOString(),
  }

  const query = parsed.data.id
    ? context.supabase.from('properties').update(values).eq('id', parsed.data.id).eq('client_id', context.clientId).select('id').single()
    : context.supabase.from('properties').insert(values).select('id').single()
  const { data, error } = await query
  if (error || !data) return { success: false, error: 'Não foi possível guardar a morada.' }

  revalidatePath('/cliente')
  revalidatePath('/cliente/moradas')
  return { success: true, data: { id: data.id } }
}

export async function eliminarMorada(propertyId: unknown): Promise<ActionResult<null>> {
  const parsed = uuidSchema.safeParse(propertyId)
  if (!parsed.success) return { success: false, error: 'Morada inválida.' }

  const context = await getClientContext()
  if (!context.success) return context

  const { error } = await context.supabase
    .from('properties')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .eq('client_id', context.clientId)
  if (error) return { success: false, error: 'Não foi possível arquivar a morada.' }

  revalidatePath('/cliente')
  revalidatePath('/cliente/moradas')
  return { success: true, data: null }
}

export async function guardarAvaliacao(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({
    bookingId: uuidSchema,
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).default(''),
  }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Indique uma avaliação válida.' }

  const context = await getClientContext()
  if (!context.success) return context

  const { data, error } = await context.supabase.from('booking_reviews').upsert({
    booking_id: parsed.data.bookingId,
    client_id: context.clientId,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    has_issue: false,
    issue_description: '',
    issue_photo_urls: [],
  }, { onConflict: 'booking_id' }).select('id').single()
  if (error || !data) return { success: false, error: 'Não foi possível guardar a avaliação.' }

  revalidatePath('/cliente')
  revalidatePath('/cliente/pedidos')
  return { success: true, data: { id: data.id } }
}

export async function guardarOcorrencia(input: {
  bookingId: unknown
  description: unknown
  files: File[]
}): Promise<ActionResult<{ id: string; photoCount: number }>> {
  const parsed = z.object({
    bookingId: uuidSchema,
    description: z.string().trim().min(1).max(3000),
  }).safeParse({ bookingId: input.bookingId, description: input.description })
  if (!parsed.success) return { success: false, error: 'Descreva a ocorrência antes de enviar.' }

  const files = Array.isArray(input.files) ? input.files.slice(0, 3) : []
  if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type) || file.size > 8 * 1024 * 1024)) {
    return { success: false, error: 'Cada fotografia deve ser JPG, PNG, WEBP ou HEIC e ter no máximo 8 MB.' }
  }

  const context = await getClientContext()
  if (!context.success) return context

  const paths: string[] = []
  for (const file of files) {
    const path = context.clientId + '/' + parsed.data.bookingId + '/' + crypto.randomUUID()
    const { error } = await context.supabase.storage.from('booking-issues').upload(path, file, { contentType: file.type, upsert: false })
    if (error) return { success: false, error: 'Não foi possível carregar todas as fotografias.' }
    paths.push(path)
  }

  const { data, error } = await context.supabase.from('booking_reviews').upsert({
    booking_id: parsed.data.bookingId,
    client_id: context.clientId,
    rating: 5,
    comment: '',
    has_issue: true,
    issue_description: parsed.data.description,
    issue_photo_urls: paths,
    issue_status: 'open',
  }, { onConflict: 'booking_id' }).select('id').single()
  if (error || !data) return { success: false, error: 'Não foi possível registar a ocorrência.' }

  revalidatePath('/cliente')
  revalidatePath('/cliente/pedidos')
  return { success: true, data: { id: data.id, photoCount: paths.length } }
}

export async function exportarDadosCliente(): Promise<ActionResult<Record<string, unknown>>> {
  const context = await getClientContext()
  if (!context.success) return context

  const [clientResult, propertiesResult, ordersResult, reviewsResult] = await Promise.all([
    context.supabase.from('clients').select('id, name, email, phone, address, postal_code, locality').eq('id', context.clientId).single(),
    context.supabase.from('properties').select('*').eq('client_id', context.clientId),
    context.supabase.from('orders').select('id, service_type, scheduled_date, total_amount, status, notes').eq('client_id', context.clientId).order('scheduled_date', { ascending: false }),
    context.supabase.from('booking_reviews').select('booking_id, rating, comment, has_issue, issue_description, created_at').eq('client_id', context.clientId),
  ])
  return {
    success: true,
    data: {
      exportado_em: new Date().toISOString(),
      cliente: clientResult.data,
      moradas: propertiesResult.data ?? [],
      agendamentos: ordersResult.data ?? [],
      avaliacoes: reviewsResult.data ?? [],
    },
  }
}

export async function eliminarConta(): Promise<ActionResult<null>> {
  const context = await getClientContext()
  if (!context.success) return context

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return { success: false, error: 'A eliminação de conta ainda não está configurada no servidor.' }

  const admin = createSupabaseAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anonymisedEmail = `eliminado+${context.user.id}@rrservices.invalid`
  const { error: clientError } = await admin.from('clients').update({
    name: 'Cliente eliminado',
    email: anonymisedEmail,
    phone: null,
    address: null,
    postal_code: null,
    locality: null,
    notes: null,
    auth_user_id: null,
  }).eq('id', context.clientId)
  if (clientError) return { success: false, error: 'Não foi possível anonimizar os dados do cliente.' }

  await admin.from('properties').delete().eq('client_id', context.clientId)
  await admin.from('profiles').delete().eq('id', context.user.id)
  const { error: authError } = await admin.auth.admin.deleteUser(context.user.id)
  if (authError) return { success: false, error: 'Os dados foram anonimizados, mas não foi possível eliminar a conta de acesso.' }

  return { success: true, data: null }
}

