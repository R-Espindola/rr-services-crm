'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin-auth'

export type AdminReview = {
  id: string
  booking_id: string
  clientName: string
  workerName: string
  rating: number
  comment: string | null
  has_issue: boolean
  issue_description: string | null
  issue_status: 'open' | 'resolved'
  created_at: string
  photoUrls: string[]
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }
const uuidSchema = z.string().uuid()

export async function listAdminReviews(): Promise<ActionResult<AdminReview[]>> {
  const session = await getAdminSession()
  if (!session.success) return session
  const { data, error } = await session.supabase.from('booking_reviews')
    .select('id, booking_id, client_id, rating, comment, has_issue, issue_description, issue_status, issue_photo_urls, created_at')
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: 'Não foi possível carregar as avaliações.' }

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const clientIds = [...new Set(rows.map((row) => typeof row.client_id === 'string' ? row.client_id : '').filter(Boolean))]
  const bookingIds = [...new Set(rows.map((row) => typeof row.booking_id === 'string' ? row.booking_id : '').filter(Boolean))]
  const [{ data: clients }, { data: orders }] = await Promise.all([
    session.supabase.from('clients').select('id, name').in('id', clientIds),
    session.supabase.from('orders').select('id, worker_user_id').in('id', bookingIds),
  ])
  const clientNames = new Map((clients ?? []).map((row) => [row.id as string, row.name as string]))
  const orderRows = (orders ?? []) as Array<{ id: string; worker_user_id: string | null }>
  const workerIds = orderRows.map((row) => row.worker_user_id).filter((value): value is string => Boolean(value))
  const { data: workers } = workerIds.length ? await session.supabase.from('worker_profiles').select('user_id, display_name').in('user_id', workerIds) : { data: [] }
  const workerNames = new Map((workers ?? []).map((row) => [row.user_id as string, row.display_name as string]))
  const workersByBooking = new Map(orderRows.map((row) => [row.id, row.worker_user_id ? workerNames.get(row.worker_user_id) ?? 'Equipa não identificada' : 'Por atribuir']))

  const reviewRows = await Promise.all(rows.map(async (row): Promise<AdminReview> => {
    const paths = Array.isArray(row.issue_photo_urls) ? row.issue_photo_urls.filter((path): path is string => typeof path === 'string').slice(0, 3) : []
    const signed = await Promise.all(paths.map(async (path) => {
      const result = await session.supabase.storage.from('booking-issues').createSignedUrl(path, 60 * 60)
      return result.data?.signedUrl ?? null
    }))
    return {
      id: String(row.id), booking_id: String(row.booking_id), clientName: clientNames.get(String(row.client_id)) ?? 'Cliente',
      workerName: workersByBooking.get(String(row.booking_id)) ?? 'Por atribuir', rating: Number(row.rating),
      comment: typeof row.comment === 'string' ? row.comment : null, has_issue: row.has_issue === true,
      issue_description: typeof row.issue_description === 'string' ? row.issue_description : null,
      issue_status: row.issue_status === 'resolved' ? 'resolved' : 'open', created_at: String(row.created_at),
      photoUrls: signed.filter((url): url is string => Boolean(url)),
    }
  }))
  return { success: true, data: reviewRows }
}

export async function resolverOcorrencia(reviewIdInput: unknown): Promise<ActionResult<null>> {
  const parsed = uuidSchema.safeParse(reviewIdInput)
  if (!parsed.success) return { success: false, error: 'Ocorrência inválida.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { error } = await session.supabase.from('booking_reviews').update({ issue_status: 'resolved' }).eq('id', parsed.data)
  if (error) return { success: false, error: 'Não foi possível marcar a ocorrência como resolvida.' }
  revalidatePath('/admin/ocorrencias')
  return { success: true, data: null }
}
