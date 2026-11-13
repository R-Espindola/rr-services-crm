import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { sendNotification, setVapidDetails } from 'web-push'
import { isAllowedPushEndpoint } from '@/lib/push-endpoint'

type WorkerPushMessage = {
  title: string
  body: string
  url: '/trabalhador' | '/trabalhador/agenda'
}

type WorkerPushResult = {
  sent: number
  warning?: string
}

export async function sendWorkerPush(
  workerUserId: string,
  message: WorkerPushMessage,
): Promise<WorkerPushResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('Web Push não configurado: faltam variáveis de ambiente obrigatórias.')
    return { sent: 0, warning: 'Push indisponível: falta configurar o servidor.' }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: subscriptions, error } = await supabase
    .from('worker_push_subscriptions')
    .select('endpoint, subscription')
    .eq('worker_user_id', workerUserId)

  if (error) {
    console.error('Não foi possível carregar subscrições push do trabalhador:', error.message)
    return { sent: 0, warning: 'Push indisponível: não foi possível carregar as subscrições.' }
  }
  if (!subscriptions?.length) {
    return { sent: 0, warning: 'O trabalhador ainda não ativou as notificações push.' }
  }

  try {
    setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  } catch (cause) {
    console.error('As chaves VAPID das notificações push são inválidas:', cause instanceof Error ? cause.message : 'erro desconhecido')
    return { sent: 0, warning: 'Push indisponível: as chaves do servidor são inválidas.' }
  }
  const payload = JSON.stringify({ ...message, icon: '/rr-icon.svg', badge: '/rr-icon.svg' })
  const outcomes = await Promise.all(subscriptions.map(async ({ endpoint, subscription }) => {
    const subscriptionDetails = subscription && typeof subscription === 'object'
      ? subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
      : null
    if (!isAllowedPushEndpoint(endpoint)
        || subscriptionDetails?.endpoint !== endpoint
        || typeof subscriptionDetails.keys?.p256dh !== 'string'
        || typeof subscriptionDetails.keys.auth !== 'string') {
      console.error('Foi ignorada uma subscrição push inválida.')
      return false
    }

    try {
      await sendNotification({
        endpoint,
        keys: {
          p256dh: subscriptionDetails.keys.p256dh,
          auth: subscriptionDetails.keys.auth,
        },
      }, payload)
      return true
    } catch (cause) {
      const statusCode = cause && typeof cause === 'object' && 'statusCode' in cause
        ? Number(cause.statusCode)
        : 0
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await supabase
          .from('worker_push_subscriptions')
          .delete()
          .eq('endpoint', endpoint)
          .eq('worker_user_id', workerUserId)
        if (deleteError) console.error('Não foi possível remover uma subscrição push expirada:', deleteError.message)
      } else {
        console.error('Falha ao enviar notificação push ao trabalhador:', { statusCode })
      }
      return false
    }
  }))

  const sent = outcomes.filter(Boolean).length
  if (sent === subscriptions.length) return { sent }
  if (sent > 0) return { sent, warning: 'A notificação só foi entregue a alguns dispositivos.' }
  return { sent: 0, warning: 'Não foi possível entregar a notificação push.' }
}
