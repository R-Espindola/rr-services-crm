'use client'

import { useEffect, useState } from 'react'

type PushState = 'checking' | 'unsupported' | 'disabled' | 'enabled' | 'busy' | 'blocked'

function decodeApplicationServerKey(value: string) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

async function subscriptionRequest(method: 'POST' | 'DELETE', body: unknown) {
  const response = await fetch('/api/trabalhador/push-subscriptions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(result?.error || 'Não foi possível atualizar as notificações.')
  }
}

export default function WorkerPushSubscription() {
  const [state, setState] = useState<PushState>('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function checkSubscription(): Promise<{ state: PushState; message?: string }> {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return { state: 'unsupported' }
      }
      if (Notification.permission === 'denied') return { state: 'blocked' }
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const subscription = await registration.pushManager.getSubscription()
        return { state: subscription ? 'enabled' : 'disabled' }
      } catch {
        return { state: 'unsupported', message: 'Não foi possível preparar as notificações neste navegador.' }
      }
    }

    void checkSubscription().then((result) => {
      if (!active) return
      setState(result.state)
      if (result.message) setMessage(result.message)
    })

    return () => { active = false }
  }, [])

  async function enablePush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      setMessage('O servidor ainda não tem as notificações push configuradas.')
      return
    }

    setState('busy')
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'disabled')
        setMessage('A permissão para notificações não foi concedida.')
        return
      }
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey) as BufferSource,
      })
      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('O navegador devolveu uma subscrição incompleta.')
      }
      await subscriptionRequest('POST', json)
      setState('enabled')
      setMessage('Notificações push ativadas neste dispositivo.')
    } catch (cause) {
      setState('disabled')
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível ativar as notificações.')
    }
  }

  async function disablePush() {
    setState('busy')
    setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscriptionRequest('DELETE', { endpoint: subscription.endpoint })
        await subscription.unsubscribe()
      }
      setState('disabled')
      setMessage('Notificações push desativadas neste dispositivo.')
    } catch (cause) {
      setState('enabled')
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível desativar as notificações.')
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-[#0B192C]">Notificações de agenda</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
            Receba avisos quando lhe atribuírem uma limpeza ou alterarem/cancelarem um serviço.
          </p>
        </div>
        {state === 'enabled' ? (
          <button type="button" onClick={() => void disablePush()} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
            Desativar neste dispositivo
          </button>
        ) : (
          <button type="button" disabled={state === 'checking' || state === 'busy' || state === 'unsupported' || state === 'blocked'} onClick={() => void enablePush()} className="min-h-11 rounded-xl bg-[#0B192C] px-4 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
            {state === 'checking' || state === 'busy' ? 'A verificar...' : state === 'blocked' ? 'Permissão bloqueada' : 'Ativar notificações'}
          </button>
        )}
      </div>
      {message && <p role="status" className="mt-3 text-xs font-semibold text-slate-600">{message}</p>}
      {state === 'unsupported' && !message && <p className="mt-3 text-xs text-amber-700">Este navegador não suporta notificações push.</p>}
      {state === 'blocked' && <p className="mt-3 text-xs text-amber-700">Permita notificações nas definições do navegador para as poder ativar.</p>}
      <p className="mt-3 text-[11px] leading-5 text-slate-400">
        Em iPhone ou iPad, o portal tem de estar adicionado ao ecrã principal para receber notificações push.
      </p>
    </section>
  )
}
