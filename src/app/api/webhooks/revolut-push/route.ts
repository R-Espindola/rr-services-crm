import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { parseRevolutNotification } from '@/lib/revolut/notification-parser'
import { processRevolutNotification } from '@/lib/revolut/transaction-processor'

export const runtime = 'nodejs'

const notificationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(4000),
  timestamp: z.string().datetime({ offset: true }).optional(),
})

const MAX_BODY_BYTES = 8192

export async function POST(request: Request) {
  const expectedSecret = process.env.REVOLUT_PUSH_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 500 })
  }

  const receivedSecret = request.headers.get('x-webhook-secret')
  if (!receivedSecret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const expectedBuffer = Buffer.from(expectedSecret, 'utf8')
  const receivedBuffer = Buffer.from(receivedSecret, 'utf8')
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o pedido.' }, { status: 400 })
  }

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
  }

  let body: Record<string, unknown> = {}
  try {
    const sanitized = rawBody.replace(/\r?\n/g, ' ')
    const parsedJson = JSON.parse(sanitized)
    if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
      body = parsedJson as Record<string, unknown>
    }
  } catch {
    const params = new URLSearchParams(rawBody)
    body = {
      title: params.get('title') ?? '',
      text: params.get('text') ?? '',
    }
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''

  if (!title || !text || text === '[notification]' || title === '[not_title]') {
    return NextResponse.json(
      { received: true, ignored: 'empty_or_test_notification' },
      { status: 200 }
    )
  }

  const validation = notificationSchema.safeParse({
    title,
    text,
    timestamp: typeof body.timestamp === 'string' ? body.timestamp : undefined,
  })

  if (!validation.success) {
    return NextResponse.json({ error: 'Notificação inválida.' }, { status: 400 })
  }

  const parsed = parseRevolutNotification({
    title: validation.data.title,
    text: validation.data.text,
    timestamp: validation.data.timestamp ? new Date(validation.data.timestamp) : new Date(),
  })

  if (!parsed) {
    return NextResponse.json(
      { received: true, ignored: 'non_transactional_notification' },
      { status: 200 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Persistência do webhook não configurada.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const result = await processRevolutNotification(supabase, parsed, validation.data.title, validation.data.text)
    return NextResponse.json({
      received: true,
      duplicate: !result.inserted,
      reconciled: result.inserted && result.reconciled,
    })
  } catch (error) {
    console.error('Revolut push webhook processing failed', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Não foi possível processar a notificação.' }, { status: 500 })
  }
}