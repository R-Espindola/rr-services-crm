import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { isAllowedPushEndpoint } from '@/lib/push-endpoint'

type PushSubscriptionInput = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

async function readRequestBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return { response: NextResponse.json({ error: 'Pedido vazio.' }, { status: 400 }) }

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > 8192) {
      await reader.cancel()
      return { response: NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 }) }
    }
    chunks.push(value)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { input: JSON.parse(new TextDecoder().decode(body)) as unknown }
  } catch {
    return { response: NextResponse.json({ error: 'Pedido JSON inválido.' }, { status: 400 }) }
  }
}

function isPushSubscription(value: unknown): value is PushSubscriptionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  if (!isAllowedPushEndpoint(input.endpoint)) return false
  if (!input.keys || typeof input.keys !== 'object' || Array.isArray(input.keys)) return false
  const keys = input.keys as Record<string, unknown>
  return typeof keys.p256dh === 'string' && keys.p256dh.length > 0 && keys.p256dh.length <= 256
    && typeof keys.auth === 'string' && keys.auth.length > 0 && keys.auth.length <= 256
}

async function getActiveWorker() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { response: NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 }) }

  const { data: worker, error: workerError } = await supabase
    .from('worker_profiles')
    .select('active')
    .eq('user_id', user.id)
    .maybeSingle()
  if (workerError) {
    console.error('Não foi possível validar o perfil do trabalhador:', workerError.message)
    return { response: NextResponse.json({ error: 'Não foi possível validar o perfil.' }, { status: 500 }) }
  }
  if (!worker?.active) return { response: NextResponse.json({ error: 'Perfil de trabalhador inativo.' }, { status: 403 }) }
  return { supabase, user }
}

export async function POST(request: Request) {
  const parsed = await readRequestBody(request)
  if ('response' in parsed) return parsed.response
  const input = parsed.input
  if (!isPushSubscription(input)) {
    return NextResponse.json({ error: 'Subscrição push inválida.' }, { status: 400 })
  }

  const worker = await getActiveWorker()
  if ('response' in worker) return worker.response

  const { count, error: countError } = await worker.supabase.from('worker_push_subscriptions')
    .select('endpoint', { count: 'exact', head: true })
    .eq('worker_user_id', worker.user.id)
  if (countError) {
    console.error('Não foi possível contar as subscrições push:', countError.message)
    return NextResponse.json({ error: 'Não foi possível ativar as notificações.' }, { status: 500 })
  }
  const { data: existing, error: existingError } = await worker.supabase
    .from('worker_push_subscriptions')
    .select('endpoint')
    .eq('worker_user_id', worker.user.id)
    .eq('endpoint', input.endpoint)
    .maybeSingle()
  if (existingError) {
    console.error('Não foi possível verificar a subscrição push:', existingError.message)
    return NextResponse.json({ error: 'Não foi possível ativar as notificações.' }, { status: 500 })
  }
  if (!existing && (count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Já existem cinco dispositivos ativos. Desative um dispositivo antes de adicionar outro.' }, { status: 409 })
  }

  const { error } = await worker.supabase.from('worker_push_subscriptions').upsert({
    endpoint: input.endpoint,
    worker_user_id: worker.user.id,
    subscription: input,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) {
    console.error('Não foi possível guardar a subscrição push:', error.message)
    return NextResponse.json({ error: 'Não foi possível ativar as notificações.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const parsed = await readRequestBody(request)
  if ('response' in parsed) return parsed.response
  const input = parsed.input
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }
  const endpoint = (input as Record<string, unknown>).endpoint
  if (!isAllowedPushEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Subscrição push inválida.' }, { status: 400 })
  }

  const worker = await getActiveWorker()
  if ('response' in worker) return worker.response

  const { error } = await worker.supabase.from('worker_push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('worker_user_id', worker.user.id)
  if (error) {
    console.error('Não foi possível remover a subscrição push:', error.message)
    return NextResponse.json({ error: 'Não foi possível desativar as notificações.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
