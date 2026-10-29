'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ChecklistItem = { id: string; label: string; done: boolean }
type ClientInfo = { name: string | null; address: string | null; phone: string | null }
type Order = {
  id: string
  client_id: string
  service_type: string
  scheduled_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  started_at: string | null
  completed_at: string | null
  duration_minutes: number | null
  paused_at: string | null
  paused_duration_seconds: number
  worker_checklist: ChecklistItem[] | null
  before_photos: string[] | null
  after_photos: string[] | null
  clients: ClientInfo | ClientInfo[] | null
}
type Photo = { path: string; url: string }

const defaultTasks = (service: string): ChecklistItem[] => {
  const tasks = /vidro|janela/i.test(service)
    ? ['Limpar vidros e caixilhos', 'Remover marcas e pó', 'Confirmar acabamento']
    : /obra|profunda/i.test(service)
      ? ['Remover pó de todas as superfícies', 'Higienizar cozinha e casas de banho', 'Limpar pavimentos', 'Verificar detalhes e acabamento']
      : ['Aspirar e lavar pavimentos', 'Higienizar casa de banho', 'Limpar cozinha e superfícies', 'Remover pó e limpar áreas de contacto']
  return tasks.map((label, index) => ({ id: `task-${index + 1}`, label, done: false }))
}

const getClient = (client: Order['clients']): ClientInfo => Array.isArray(client) ? client[0] ?? { name: null, address: null, phone: null } : client ?? { name: null, address: null, phone: null }
const formatTime = (value: string) => new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
const elapsedSeconds = (order: Order, now: number) => {
  if (!order.started_at) return 0
  const end = order.paused_at ? new Date(order.paused_at).getTime() : now
  const paused = order.paused_duration_seconds || 0
  return Math.max(0, Math.floor((end - new Date(order.started_at).getTime()) / 1000) - paused)
}
const durationClock = (seconds: number) => {
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
const completedMinutes = (order: Order) => order.duration_minutes ?? (order.started_at && order.completed_at
  ? Math.max(0, Math.floor((new Date(order.completed_at).getTime() - new Date(order.started_at).getTime() - (order.paused_duration_seconds || 0) * 1000) / 60_000))
  : 0)

export default function WorkerAgendaPage() {
  const router = useRouter()
  const [workerName, setWorkerName] = useState('')
  const [userId, setUserId] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [photos, setPhotos] = useState<Record<string, { before: Photo[]; after: Photo[] }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [clock, setClock] = useState(0)

  const loadToday = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setError('A sua sessão terminou. Inicie sessão novamente para consultar a agenda.')
        return
      }
      setUserId(user.id)
      const { data: worker, error: workerError } = await supabase.from('worker_profiles')
        .select('display_name, active').eq('user_id', user.id).maybeSingle()
      if (workerError || !worker?.active) {
        setError('Não existe um perfil de trabalhador ativo associado a esta conta.')
        return
      }
      setWorkerName(worker.display_name)

      // Use the device's local calendar day to include the complete workday.
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      const { data, error: ordersError } = await supabase.from('orders')
        .select('id, client_id, service_type, scheduled_date, status, notes, started_at, completed_at, duration_minutes, paused_at, paused_duration_seconds, worker_checklist, before_photos, after_photos, clients(name, address, phone)')
        .eq('worker_user_id', user.id)
        .gte('scheduled_date', start.toISOString())
        .lt('scheduled_date', end.toISOString())
        .order('scheduled_date', { ascending: true })
      if (ordersError) throw ordersError

      const rows = ((data ?? []) as unknown as Order[]).map((order) => ({
        ...order,
        worker_checklist: order.worker_checklist?.length ? order.worker_checklist : defaultTasks(order.service_type),
      }))
      setOrders(rows)

      const signed: typeof photos = {}
      await Promise.all(rows.map(async (order) => {
        signed[order.id] = { before: [], after: [] }
        for (const kind of ['before', 'after'] as const) {
          const paths = order[kind === 'before' ? 'before_photos' : 'after_photos'] ?? []
          const urls = await Promise.all(paths.map(async (path) => {
            const { data: signedUrl } = await supabase.storage.from('worker-cleaning-photos').createSignedUrl(path, 600)
            return signedUrl?.signedUrl ? { path, url: signedUrl.signedUrl } : null
          }))
          signed[order.id][kind] = urls.filter((photo): photo is Photo => photo !== null)
        }
      }))
      setPhotos(signed)
    } catch {
      setError('Não foi possível carregar a agenda. Tente novamente dentro de momentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => { void loadToday() }, 0)
    return () => window.clearTimeout(request)
  }, [loadToday])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const counts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    active: orders.filter((order) => order.status === 'in_progress').length,
    completed: orders.filter((order) => order.status === 'completed').length,
  }), [orders])

  async function updateOrder(order: Order, action: 'start' | 'pause' | 'resume' | 'finish') {
    setBusy(`${action}-${order.id}`)
    setNotice('')
    try {
      const rpcName = { start: 'worker_start_cleaning', pause: 'worker_pause_cleaning', resume: 'worker_resume_cleaning', finish: 'worker_finish_cleaning' }[action]
      const { error: rpcError } = await supabase.rpc(rpcName, { p_order_id: order.id })
      if (rpcError) throw rpcError
      setNotice({ start: 'Limpeza iniciada. Bom trabalho!', pause: 'Cronómetro pausado.', resume: 'Cronómetro retomado.', finish: 'Limpeza concluída com sucesso.' }[action])
      await loadToday()
    } catch {
      setError('Não foi possível atualizar o estado da limpeza. Atualize a página e tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function toggleTask(order: Order, taskId: string) {
    const checklist = (order.worker_checklist ?? []).map((task) => task.id === taskId ? { ...task, done: !task.done } : task)
    setBusy(`checklist-${order.id}`)
    try {
      const { error: rpcError } = await supabase.rpc('worker_save_checklist', { p_order_id: order.id, p_checklist: checklist })
      if (rpcError) throw rpcError
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, worker_checklist: checklist } : item))
    } catch {
      setError('Não foi possível guardar a checklist. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function uploadPhotos(order: Order, kind: 'before' | 'after', files: FileList | null) {
    if (!files?.length || !userId) return
    setBusy(`photo-${order.id}`)
    setError('')
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
          throw new Error('Escolha imagens até 10 MB.')
        }
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${userId}/${order.id}/${kind}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from('worker-cleaning-photos').upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        const { error: attachError } = await supabase.rpc('worker_attach_photo', { p_order_id: order.id, p_photo_type: kind, p_storage_path: path })
        if (attachError) throw attachError
        const { data: signed } = await supabase.storage.from('worker-cleaning-photos').createSignedUrl(path, 600)
        if (signed?.signedUrl) {
          setPhotos((current) => ({ ...current, [order.id]: { before: current[order.id]?.before ?? [], after: current[order.id]?.after ?? [], [kind]: [...(current[order.id]?.[kind] ?? []), { path, url: signed.signedUrl }] } }))
        }
      }
      setNotice('Fotografia guardada com sucesso.')
      await loadToday()
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'Escolha imagens até 10 MB.' ? cause.message : 'Não foi possível enviar as fotografias. Confirme a ligação e tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return <main className="flex min-h-dvh items-center justify-center bg-[#F3F6FA] px-5 text-sm font-semibold text-slate-500">A carregar a sua agenda...</main>
  if (error && !orders.length) return <main className="flex min-h-dvh items-center justify-center bg-[#F3F6FA] px-5"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm"><p className="text-sm font-semibold text-rose-700">{error}</p><Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#0B192C] px-4 text-sm font-bold text-white">Iniciar sessão</Link></div></main>

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F3F6FA] text-[#0B192C]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#081426]/95 text-white shadow-xl backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/trabalhador/agenda" className="flex items-center gap-3" aria-label="R&R Services — portal do trabalhador">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#0B192C]">R&amp;R</span>
            <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Portal do trabalhador</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:block">{workerName}</span>
            <button type="button" onClick={signOut} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-xs font-bold text-slate-200 hover:bg-white/10">Terminar sessão</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200/80 bg-white/70 px-4 py-7 lg:block">
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Área de trabalho</p>
          <nav aria-label="Área de trabalho" className="mt-4 space-y-1"><Link href="/trabalhador/agenda" className="flex min-h-12 items-center gap-3 rounded-xl bg-[#0B192C] px-3 text-[13px] font-semibold text-white shadow-lg"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00D4FF] text-[#0B192C]">▦</span>Agenda de hoje<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00D4FF]" /></Link><Link href="/trabalhador/horas" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">◷</span>Horas trabalhadas</Link><Link href="/trabalhador/perfil" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">◎</span>Segurança</Link></nav>
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-[#0B192C] to-[#173957] p-4 text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-lg text-[#0B192C]">✦</span><p className="mt-4 text-sm font-extrabold">Bom trabalho!</p><p className="mt-2 text-xs leading-5 text-slate-300">Consulte os detalhes de cada visita e atualize o progresso ao longo do dia.</p></div>
          <p className="mt-8 px-3 text-[10px] text-slate-400">© 2026 R&amp;R Services</p>
        </aside>

        <main className="min-w-0 px-4 pb-24 pt-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          <section className="relative isolate overflow-hidden rounded-[28px] bg-[#0B192C] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8 lg:p-10">
            <div className="absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-[#00D4FF]/15 blur-3xl" />
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#70E8FF]"><span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF]" /> Agenda diária</span><h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Bom dia, {workerName.split(/\s+/)[0]}<span className="text-[#00D4FF]">.</span></h1><p className="mt-3 text-sm capitalize leading-6 text-slate-300 sm:text-base">{formatDate(new Date().toISOString())}. Aqui está o plano das suas visitas.</p></div><button type="button" onClick={() => void loadToday()} className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#0B192C] transition hover:bg-[#00D4FF] sm:self-auto"><span aria-hidden="true">↻</span> Atualizar agenda</button></div>
            <div className="mt-8 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
              {[['Visitas de hoje', counts.total, '▦'], ['Por iniciar', counts.pending, '◷'], ['Em andamento', counts.active, '↗'], ['Concluídas', counts.completed, '✓']].map(([label, value, icon]) => <div key={String(label)} className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF]">{icon}</span><span><span className="block text-[10px] uppercase tracking-wider text-slate-400">{label}</span><span className="mt-1 block text-lg font-black">{value}</span></span></div>)}
            </div>
          </section>

          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}
          {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
          <div className="mt-8 flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">Rota de trabalho</p><h2 className="mt-1 text-2xl font-black tracking-tight">As suas visitas</h2></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">{counts.total} {counts.total === 1 ? 'serviço' : 'serviços'}</span></div>

          {orders.length === 0 ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-700">✓</span><h3 className="mt-4 font-extrabold">Sem visitas atribuídas para hoje</h3><p className="mt-2 text-sm text-slate-500">Quando a equipa atribuir serviços à sua conta, aparecem aqui.</p></div> : <div className="mt-5 space-y-5">{orders.map((order) => {
            const client = getClient(order.clients)
            const address = client.address?.trim() ?? ''
            const checklist = order.worker_checklist ?? []
            const status = order.status === 'pending' ? { label: 'Não iniciada', style: 'bg-amber-50 text-amber-700 ring-amber-200' } : order.status === 'in_progress' && order.paused_at ? { label: 'Pausada', style: 'bg-violet-50 text-violet-700 ring-violet-200' } : order.status === 'in_progress' ? { label: 'Em andamento', style: 'bg-sky-50 text-sky-700 ring-sky-200' } : order.status === 'completed' ? { label: 'Concluída', style: 'bg-emerald-50 text-emerald-700 ring-emerald-200' } : { label: 'Cancelada', style: 'bg-rose-50 text-rose-700 ring-rose-200' }
            const canEdit = order.status === 'pending' || order.status === 'in_progress'
            return <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] sm:rounded-3xl">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div className="flex min-w-0 gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B192C] text-lg text-[#00D4FF]">⌂</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-extrabold">{client.name || 'Cliente'}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ring-inset ${status.style}`}>{status.label}</span></div><p className="mt-1 text-sm font-semibold text-slate-600">{order.service_type}</p><p className="mt-2 text-xs font-medium capitalize text-slate-400">{formatTime(order.scheduled_date)} · {formatDate(order.scheduled_date)}</p></div></div>
                {order.status === 'pending' && <button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'start')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"><span aria-hidden="true">▶</span>{busy === `start-${order.id}` ? 'A iniciar...' : 'Iniciar limpeza'}</button>}
                {order.status === 'in_progress' && <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-48"><span className="text-center font-mono text-sm font-bold tabular-nums text-sky-700">{durationClock(elapsedSeconds(order, clock))}</span><div className="grid grid-cols-2 gap-2"><button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, order.paused_at ? 'resume' : 'pause')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">{busy === `${order.paused_at ? 'resume' : 'pause'}-${order.id}` ? 'A guardar...' : order.paused_at ? '▶ Retomar' : 'Ⅱ Pausar'}</button><button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'finish')} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 text-[11px] font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{busy === `finish-${order.id}` ? 'A concluir...' : '✓ Concluir limpeza'}</button></div></div>}
              </div>
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <div className="space-y-5"><section><h4 className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Morada do serviço</h4><p className="mt-2 text-sm font-semibold leading-6 text-[#0B192C]">{address || 'Morada não registada'}</p>{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"><span aria-hidden="true">➤</span>Abrir no GPS</a>}</section>
                  {client.phone && <a href={`tel:${client.phone}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-700 hover:text-sky-900">☎ {client.phone}</a>}
                  {order.notes && <section className="rounded-xl bg-slate-50 p-4"><h4 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Notas do serviço</h4><p className="mt-2 text-sm leading-6 text-slate-700">{order.notes}</p></section>}
                </div>
                <section><div className="flex items-center justify-between gap-3"><h4 className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Checklist</h4><span className="text-xs font-bold text-slate-500">{checklist.filter((task) => task.done).length}/{checklist.length}</span></div><div className="mt-3 space-y-2">{checklist.map((task) => <label key={task.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${task.done ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-100 bg-slate-50 hover:border-slate-200'} ${!canEdit || busy === `checklist-${order.id}` ? 'cursor-not-allowed opacity-70' : ''}`}><input type="checkbox" checked={task.done} disabled={!canEdit || busy === `checklist-${order.id}`} onChange={() => void toggleTask(order, task.id)} className="h-5 w-5 rounded border-slate-300 accent-sky-600 focus:ring-2 focus:ring-sky-500"/><span className={`text-sm font-medium ${task.done ? 'text-emerald-800 line-through decoration-emerald-400' : 'text-slate-700'}`}>{task.label}</span></label>)}</div></section>
              </div>
              <div className="grid gap-4 border-t border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-2 sm:p-6">
                {(['before', 'after'] as const).map((kind) => {
                  const canUpload = kind === 'before' ? canEdit : order.status === 'in_progress' || order.status === 'completed'
                  return <section key={kind} className="min-w-0"><div className="flex items-center justify-between gap-2"><h4 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{kind === 'before' ? 'Fotos antes' : 'Fotos depois'}</h4>{canUpload && <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:border-sky-300 hover:text-sky-700">{busy === `photo-${order.id}` ? 'A enviar...' : '+ Adicionar foto'}<input type="file" accept="image/*" capture="environment" multiple disabled={busy !== null} onChange={(event) => { void uploadPhotos(order, kind, event.target.files); event.currentTarget.value = '' }} className="sr-only" aria-label={`Adicionar fotos ${kind === 'before' ? 'antes' : 'depois'}`} /></label>}</div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{(photos[order.id]?.[kind] ?? []).map((photo) => <a key={photo.path} href={photo.url} target="_blank" rel="noreferrer" className="block shrink-0"><Image src={photo.url} width={80} height={80} unoptimized alt={`Fotografia ${kind === 'before' ? 'antes' : 'depois'} da limpeza`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" /></a>)}{!photos[order.id]?.[kind]?.length && <p className="py-2 text-xs text-slate-400">Ainda sem fotografias.</p>}</div></section>
                })}
              </div>
              {order.status === 'completed' && order.completed_at && <p className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6"><span>Concluída às {formatTime(order.completed_at)}</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 font-extrabold text-emerald-800">Duração: {formatDuration(completedMinutes(order))}</span></p>}
            </article>
          })}</div>}
        </main>
      </div>
      <nav aria-label="Navegação do trabalhador" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-lg lg:hidden"><Link href="/trabalhador/agenda" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sky-800"><span aria-hidden="true" className="text-lg">▦</span><span className="text-[10px] font-extrabold">Agenda</span></Link><Link href="/trabalhador/horas" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500"><span aria-hidden="true" className="text-lg">◷</span><span className="text-[10px] font-bold">Horas</span></Link><Link href="/trabalhador/perfil" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500"><span aria-hidden="true" className="text-lg">◎</span><span className="text-[10px] font-bold">Segurança</span></Link></nav>
    </div>
  )
}
