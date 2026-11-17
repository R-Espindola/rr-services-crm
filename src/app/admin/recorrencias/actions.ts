'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin-auth'

export type RecurringSchedule = { id: string; clientName: string; propertyLabel: string; frequency: string; preferred_weekday: number | null; preferred_start_time: string | null; status: 'active' | 'paused' | 'cancelled'; paused_until: string | null }
export type RecurringFormOptions = {
  clients: Array<{ id: string; name: string; address: string | null; postal_code: string | null; locality: string | null }>
  properties: Array<{ id: string; client_id: string; label: string; street_address: string; postal_code: string; city: string }>
  services: Array<{ id: string; name: string }>
}
type ActionResult<T> = { success: true; data: T } | { success: false; error: string }
const inputSchema = z.object({ id: z.string().uuid(), status: z.enum(['active', 'paused', 'cancelled']), pausedUntil: z.string().date().nullable() })
const createSchema = z.object({
  clientId: z.string().uuid(), propertyId: z.string().uuid().nullable(), serviceTypeId: z.string().uuid(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']), preferredWeekday: z.coerce.number().int().min(0).max(6),
  preferredStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), preferredEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  nextGenerationDate: z.string().date(),
})

export async function listRecurringFormOptions(): Promise<ActionResult<RecurringFormOptions>> {
  const session = await getAdminSession()
  if (!session.success) return session
  const [{ data: clients, error: clientsError }, { data: properties, error: propertiesError }, { data: services, error: servicesError }] = await Promise.all([
    session.supabase.from('clients').select('id, name, address, postal_code, locality').eq('role', 'client').order('name'),
    session.supabase.from('properties').select('id, client_id, label, street_address, postal_code, city').eq('is_active', true).order('label'),
    session.supabase.from('services_catalog').select('id, name').eq('is_available', true).order('name'),
  ])
  if (clientsError || propertiesError || servicesError) return { success: false, error: 'Não foi possível carregar as opções do novo plano.' }
  return { success: true, data: { clients: (clients ?? []) as RecurringFormOptions['clients'], properties: (properties ?? []) as RecurringFormOptions['properties'], services: (services ?? []) as RecurringFormOptions['services'] } }
}

export async function criarPlanoRecorrente(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Verifique os dados do plano recorrente.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const values = parsed.data
  const { data: client, error: clientError } = await session.supabase.from('clients').select('id, name, address, postal_code, locality').eq('id', values.clientId).eq('role', 'client').maybeSingle()
  if (clientError || !client) return { success: false, error: 'Cliente inválido.' }

  let propertyId = values.propertyId
  if (propertyId) {
    const { data: property, error } = await session.supabase.from('properties').select('id').eq('id', propertyId).eq('client_id', values.clientId).maybeSingle()
    if (error || !property) return { success: false, error: 'A morada não pertence ao cliente selecionado.' }
  } else {
    if (!client.address?.trim()) return { success: false, error: 'Este cliente não tem morada de perfil para criar a Morada Principal.' }
    const postalCode = /^\d{4}-\d{3}$/.test(client.postal_code ?? '') ? client.postal_code : '0000-000'
    const { data: property, error } = await session.supabase.from('properties').insert({ client_id: values.clientId, label: 'Morada Principal', street_address: client.address.trim(), postal_code: postalCode, city: client.locality?.trim() || 'Portugal', company_provides_supplies: true, is_active: true }).select('id').single()
    if (error || !property) return { success: false, error: 'Não foi possível criar a Morada Principal.' }
    propertyId = property.id
  }

  const { data: schedule, error } = await session.supabase.from('recurring_schedules').insert({ client_id: values.clientId, property_id: propertyId, service_type_id: values.serviceTypeId, frequency: values.frequency, preferred_weekday: values.preferredWeekday, preferred_start_time: values.preferredStartTime, preferred_end_time: values.preferredEndTime, next_generation_date: values.nextGenerationDate, status: 'active' }).select('id').single()
  if (error || !schedule) return { success: false, error: 'Não foi possível criar o plano recorrente.' }
  revalidatePath('/admin/recorrencias')
  return { success: true, data: { id: schedule.id as string } }
}

export async function listRecurringSchedules(): Promise<ActionResult<RecurringSchedule[]>> {
  const session = await getAdminSession()
  if (!session.success) return session
  const { data, error } = await session.supabase.from('recurring_schedules').select('id, client_id, property_id, frequency, preferred_weekday, preferred_start_time, status, paused_until').order('created_at', { ascending: false })
  if (error) return { success: false, error: 'Não foi possível carregar os planos recorrentes.' }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const clientIds = rows.map((row) => String(row.client_id))
  const propertyIds = rows.map((row) => String(row.property_id))
  const [{ data: clients }, { data: properties }] = await Promise.all([session.supabase.from('clients').select('id, name').in('id', clientIds), session.supabase.from('properties').select('id, label').in('id', propertyIds)])
  const names = new Map((clients ?? []).map((row) => [row.id as string, row.name as string]))
  const labels = new Map((properties ?? []).map((row) => [row.id as string, row.label as string]))
  return { success: true, data: rows.map((row) => ({ id: String(row.id), clientName: names.get(String(row.client_id)) ?? 'Cliente', propertyLabel: labels.get(String(row.property_id)) ?? 'Imóvel', frequency: String(row.frequency), preferred_weekday: typeof row.preferred_weekday === 'number' ? row.preferred_weekday : null, preferred_start_time: typeof row.preferred_start_time === 'string' ? row.preferred_start_time : null, status: row.status === 'paused' || row.status === 'cancelled' ? row.status : 'active', paused_until: typeof row.paused_until === 'string' ? row.paused_until : null })) }
}

export async function gerirPlanoRecorrente(input: unknown): Promise<ActionResult<null>> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados do plano recorrente inválidos.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { error } = await session.supabase.from('recurring_schedules').update({ status: parsed.data.status, paused_until: parsed.data.status === 'paused' ? parsed.data.pausedUntil : null }).eq('id', parsed.data.id)
  if (error) return { success: false, error: 'Não foi possível atualizar o plano recorrente.' }
  revalidatePath('/admin/recorrencias')
  return { success: true, data: null }
}

export async function gerarProximasLimpezas(): Promise<ActionResult<{ count: number }>> {
  const session = await getAdminSession()
  if (!session.success) return session
  const { data, error } = await session.supabase.rpc('generate_due_recurring_orders')
  if (error) return { success: false, error: 'Não foi possível gerar as próximas limpezas.' }
  revalidatePath('/admin/recorrencias')
  revalidatePath('/admin/servicos')
  revalidatePath('/admin')
  return { success: true, data: { count: typeof data === 'number' ? data : 0 } }
}
