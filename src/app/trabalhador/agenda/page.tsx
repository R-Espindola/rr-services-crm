'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ChecklistItem = { id: string; category?: string; label: string; done: boolean }
type ClientInfo = {
  name: string | null
  address: string | null
  phone: string | null
  latitude: number | null
  longitude: number | null
}
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
  clients: ClientInfo | ClientInfo[] | null
}

const defaultTasks = (service: string): ChecklistItem[] => {
  return [
    // --- LIMPEZA BASE ---
    { category: 'Cozinha (Base)', label: 'Limpar bancadas, mesa e lava-louça', done: false },
    { category: 'Cozinha (Base)', label: 'Limpar exterior de eletrodomésticos', done: false },
    { category: 'Cozinha (Base)', label: 'Esvaziar lixo e trocar saco', done: false },

    { category: 'Casas de Banho (Base)', label: 'Desinfetar sanita e bidé', done: false },
    { category: 'Casas de Banho (Base)', label: 'Lavar poliban/banheira e lavatório', done: false },
    { category: 'Casas de Banho (Base)', label: 'Limpar espelhos e torneiras', done: false },

    { category: 'Quartos & Salas (Base)', label: 'Limpar pó de móveis e objetos', done: false },
    { category: 'Quartos & Salas (Base)', label: 'Arrumar camas e almofadas', done: false },

    { category: 'Pavimentos & Geral (Base)', label: 'Aspirar e lavar todos os chãos', done: false },
    { category: 'Pavimentos & Geral (Base)', label: 'Desinfetar interruptores e puxadores', done: false },

    // --- SERVIÇOS EXTRA ---
    { category: '✨ Serviços Extra', label: 'Limpeza de Forno (Interior)', done: false },
    { category: '✨ Serviços Extra', label: 'Limpeza de Frigorífico (Interior)', done: false },
    { category: '✨ Serviços Extra', label: 'Vidros, Caixilharia e Estores', done: false },
    { category: '✨ Serviços Extra', label: 'Passar Roupa a Ferro', done: false },
    { category: '✨ Serviços Extra', label: 'Limpeza Interior de Armários', done: false },
  ].map((item, index) => ({ id: `task-${index + 1}`, ...item }))
}

const getClient = (client: Order['clients']): ClientInfo => Array.isArray(client)
  ? client[0] ?? { name: null, address: null, phone: null, latitude: null, longitude: null }
  : client ?? { name: null, address: null, phone: null, latitude: null, longitude: null }

const formatTime = (value: string) => new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

export default function WorkerAgendaPage() {
  const router = useRouter()
  const [workerName, setWorkerName] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [clock, setClock] = useState(Date.now())
  const [agendaView, setAgendaView] = useState<'today' | 'week' | 'month'>('today')
  const [periodOffset, setPeriodOffset] = useState(0)
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null)

  // Estado para controlar se a checklist está aberta (inicia vazio, logo fica oculto por defeito)
  const [checklistOpen, setChecklistOpen] = useState<Record<string, boolean>>({})

  const toggleChecklistOpen = (orderId: string) => {
    setChecklistOpen(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  // Atualizar o relógio a cada segundo para verificar em tempo real se já atingiu a janela dos 10 min
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadAgenda = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setError('A sua sessão terminou. Inicie sessão novamente para consultar a agenda.')
        return
      }
      const { data: worker, error: workerError } = await supabase.from('worker_profiles')
        .select('display_name, active').eq('user_id', user.id).maybeSingle()
      if (workerError || !worker?.active) {
        setError('Não existe um perfil de trabalhador ativo associado a esta conta.')
        return
      }
      setWorkerName(worker.display_name)

      const start = new Date()
      start.setHours(0, 0, 0, 0)
      if (agendaView === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + periodOffset * 7)
      else if (agendaView === 'month') { start.setDate(1); start.setMonth(start.getMonth() + periodOffset) }
      else start.setDate(start.getDate() + periodOffset)
      const end = new Date(start)
      if (agendaView === 'today') {
        end.setDate(end.getDate() + 1)
      } else if (agendaView === 'week') {
        end.setDate(end.getDate() + 7)
      } else {
        end.setMonth(end.getMonth() + 1)
      }
      const { data, error: ordersError } = await supabase.from('orders')
        .select('id, client_id, service_type, scheduled_date, status, notes, started_at, completed_at, duration_minutes, paused_at, paused_duration_seconds, worker_checklist, clients(name, address, phone, latitude, longitude)')
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

    } catch {
      setError('Não foi possível carregar a agenda. Tente novamente dentro de momentos.')
    } finally {
      setLoading(false)
    }
  }, [agendaView, periodOffset])

  useEffect(() => {
    const request = window.setTimeout(() => { void loadAgenda() }, 0)
    return () => window.clearTimeout(request)
  }, [loadAgenda])

  const counts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    active: orders.filter((order) => order.status === 'in_progress').length,
    completed: orders.filter((order) => order.status === 'completed').length,
  }), [orders])

  async function updateOrder(order: Order, action: 'start' | 'pause' | 'resume' | 'finish') {
    setBusy(`${action}-${order.id}`)
    setNotice('')
    setError('')
    try {
      const rpcName = { start: 'worker_start_cleaning', pause: 'worker_pause_cleaning', resume: 'worker_resume_cleaning', finish: 'worker_finish_cleaning' }[action]
      const { error: rpcError } = await supabase.rpc(rpcName, { p_order_id: order.id })
      if (rpcError) throw rpcError
      setNotice({ start: 'Limpeza iniciada. Bom trabalho!', pause: 'Cronómetro pausado.', resume: 'Cronómetro retomado.', finish: 'Limpeza concluída com sucesso.' }[action])
      await loadAgenda()
    } catch (cause) {
      const rpcMessage = typeof cause === 'object' && cause !== null && 'message' in cause ? String(cause.message) : ''
      setError(rpcMessage.includes('Checklist has pending tasks')
        ? 'Conclua todas as tarefas da checklist antes de finalizar a limpeza.'
        : rpcMessage.includes('start window opens')
          ? 'Só poderá iniciar a limpeza a partir de 5 minutos antes do horário agendado.'
          : 'Não foi possível atualizar o estado da limpeza. Atualize a página e tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function saveChecklist(order: Order, checklist: ChecklistItem[]) {
    setBusy(`checklist-${order.id}`)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('worker_save_checklist', { p_order_id: order.id, p_checklist: checklist })
      if (rpcError) throw rpcError
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, worker_checklist: checklist } : item))
      return true
    } catch {
      setError('Não foi possível guardar a checklist. Tente novamente.')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function toggleTask(order: Order, taskId: string) {
    const checklist = (order.worker_checklist ?? []).map((task) => task.id === taskId ? { ...task, done: !task.done } : task)
    await saveChecklist(order, checklist)
  }

  const copyAddressToClipboard = async (orderId: string, addressText: string) => {
    try {
      await navigator.clipboard.writeText(addressText)
      setCopiedAddressId(orderId)
      setTimeout(() => setCopiedAddressId(null), 2500)
    } catch {
      setError('Não foi possível copiar a morada neste dispositivo.')
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
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#0B192C]">R&R</span>
            <span><span className="block text-sm font-extrabold tracking-wide">R&R SERVICES</span><span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Portal do trabalhador</span></span>
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
          <p className="mt-8 px-3 text-[10px] text-slate-400">© 2026 R&R Services</p>
        </aside>

        <main className="min-w-0 px-4 pb-32 pt-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          <section className="relative isolate overflow-hidden rounded-[28px] bg-[#0B192C] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8 lg:p-10">
            <div className="absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-[#00D4FF]/15 blur-3xl" />
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#70E8FF]"><span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF]" /> Agenda diária</span><h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Bom dia, {workerName.split(/\s+/)[0]}<span className="text-[#00D4FF]">.</span></h1><p className="mt-3 text-sm capitalize leading-6 text-slate-300 sm:text-base">{formatDate(new Date().toISOString())}. Aqui está o plano das suas visitas.</p></div><button type="button" onClick={() => void loadAgenda()} className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#0B192C] transition hover:bg-[#00D4FF] sm:self-auto"><span aria-hidden="true">↻</span> Atualizar agenda</button></div>
            <div className="mt-8 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
              {[[agendaView === 'today' ? 'Visitas de hoje' : agendaView === 'week' ? 'Visitas esta semana' : 'Visitas este mês', counts.total, '▦'], ['Por iniciar', counts.pending, '◷'], ['Em andamento', counts.active, '↗'], ['Concluídas', counts.completed, '✓']].map(([label, value, icon]) => <div key={String(label)} className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF]">{icon}</span><span><span className="block text-[10px] uppercase tracking-wider text-slate-400">{label}</span><span className="mt-1 block text-lg font-black">{value}</span></span></div>)}
            </div>
          </section>

          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}
          {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div role="tablist" aria-label="Período da agenda" className="grid flex-1 grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">{([['today', 'Hoje'], ['week', 'Esta semana'], ['month', 'Este mês']] as const).map(([view, label]) => <button key={view} type="button" role="tab" aria-selected={agendaView === view} onClick={() => { setAgendaView(view); setPeriodOffset(0) }} className={`min-h-11 rounded-xl px-3 text-sm font-extrabold transition ${agendaView === view ? 'bg-[#0B192C] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>{label}</button>)}</div>
            <div className="flex gap-2"><button type="button" aria-label="Período anterior" onClick={() => setPeriodOffset((offset) => offset - 1)} className="min-h-11 min-w-12 rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50">‹</button><button type="button" onClick={() => setPeriodOffset((offset) => offset + 1)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Seguinte ›</button>{periodOffset !== 0 && <button type="button" onClick={() => setPeriodOffset(0)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Hoje</button>}</div>
          </div>
          <div className="mt-8 flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">Rota de trabalho</p><h2 className="mt-1 text-2xl font-black tracking-tight">As suas visitas</h2></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">{counts.total} {counts.total === 1 ? 'serviço' : 'serviços'}</span></div>

          {orders.length === 0 ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-700">✓</span><h3 className="mt-4 font-extrabold">Sem visitas atribuídas {agendaView === 'today' ? 'para hoje' : agendaView === 'week' ? 'esta semana' : 'este mês'}</h3><p className="mt-2 text-sm text-slate-500">Quando a equipa atribuir serviços à sua conta, aparecem aqui.</p></div> : <div className="mt-5 space-y-5">{orders.map((order) => {
            const client = getClient(order.clients)
            const address = client.address?.trim() ?? ''
            const checklist = order.worker_checklist ?? []
            const completedTasks = checklist.filter((task) => task.done)
            const checklistComplete = checklist.length > 0 && completedTasks.length === checklist.length
            const completionProgress = checklist.length ? Math.round((completedTasks.length / checklist.length) * 100) : 0

            // O servidor permite iniciar até 5 minutos antes do agendamento.
            const startAvailableAt = new Date(order.scheduled_date).getTime() - 5 * 60_000
            const canStartNow = clock >= startAvailableAt

            // Links de Navegação (Google Maps, Waze, Apple Maps)
            const destinationQuery = client.latitude !== null && client.longitude !== null
              ? `${client.latitude},${client.longitude}`
              : address || 'Portugal'

            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationQuery)}`
            const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(destinationQuery)}&navigate=yes`
            const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(destinationQuery)}`

            // Checklist inicia SEMPRE fechada (false) por defeito
            const isOpen = checklistOpen[order.id] ?? false

            const status = order.status === 'pending' ? { label: 'Não iniciada', style: 'bg-amber-50 text-amber-700 ring-amber-200' } : order.status === 'in_progress' && order.paused_at ? { label: 'Pausada', style: 'bg-violet-50 text-violet-700 ring-violet-200' } : order.status === 'in_progress' ? { label: 'Em andamento', style: 'bg-sky-50 text-sky-700 ring-sky-200' } : order.status === 'completed' ? { label: 'Concluída', style: 'bg-emerald-50 text-emerald-700 ring-emerald-200' } : { label: 'Cancelada', style: 'bg-rose-50 text-rose-700 ring-rose-200' }

            const groupedTasks = checklist.reduce<Record<string, ChecklistItem[]>>((acc, task) => {
              const cat = task.category || 'Outras Tarefas'
              if (!acc[cat]) acc[cat] = []
              acc[cat].push(task)
              return acc
            }, {})

            return <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] sm:rounded-3xl">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="flex min-w-0 gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B192C] text-lg text-[#00D4FF]">⌂</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-extrabold">{client.name || 'Cliente'}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ring-inset ${status.style}`}>{status.label}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{order.service_type}</p>
                    <p className="mt-2 text-xs font-medium capitalize text-slate-400">{formatTime(order.scheduled_date)} · {formatDate(order.scheduled_date)}</p>
                    {client.phone && <a href={`tel:${client.phone}`} className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-sky-50 px-3 text-xs font-bold text-sky-800 hover:bg-sky-100">☎ Ligar ao cliente · {client.phone}</a>}
                    {order.notes?.trim() && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>Instruções:</strong> {order.notes}</p>}

                    {/* Morada, Botão de Copiar e Opções de Navegação (Maps, Waze, Apple Maps) */}
                    {address && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">📍 {address}</p>
                          <button
                            type="button"
                            onClick={() => copyAddressToClipboard(order.id, address)}
                            className="shrink-0 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition shadow-xs"
                          >
                            {copiedAddressId === order.id ? '✓ Morada copiada!' : '📋 Copiar morada'}
                          </button>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition">
                            🗺️ Google Maps
                          </a>
                          <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition">
                            🚗 Waze
                          </a>
                          <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition">
                            🍎 Apple Maps
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {order.status === 'pending' && (
                  <div className="w-full space-y-2 sm:w-auto sm:min-w-56">
                    <button
                      type="button"
                      disabled={busy !== null || !canStartNow}
                      onClick={() => void updateOrder(order, 'start')}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      <span aria-hidden="true">▶</span>
                      {busy === `start-${order.id}` ? 'A iniciar...' : !canStartNow ? `Disponível às ${formatTime(new Date(startAvailableAt).toISOString())}` : 'Iniciar limpeza'}
                    </button>
                    {!canStartNow && (
                      <p className="text-center text-[11px] font-semibold text-amber-700">
                        ⚠️ Disponível 5 min antes ({formatTime(new Date(startAvailableAt).toISOString())})
                      </p>
                    )}
                  </div>
                )}
                {order.status === 'in_progress' && <div className="w-full space-y-2 sm:w-auto sm:min-w-56">
                  {order.paused_at ? <button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'resume')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-extrabold text-white hover:bg-violet-800 disabled:opacity-50">{busy === `resume-${order.id}` ? 'A retomar...' : '▶ Retomar limpeza'}</button> : <button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'pause')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 text-sm font-extrabold text-violet-800 hover:bg-violet-100 disabled:opacity-50">{busy === `pause-${order.id}` ? 'A pausar...' : 'Ⅱ Pausar limpeza'}</button>}
                </div>}
              </div>

              {/* BARRA DO ACORDEÃO PARA MOSTRAR/OCULTAR CHECKLIST */}
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 sm:px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">📋 Checklist de Tarefas</span>
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold text-cyan-900">
                    {completedTasks.length} / {checklist.length} concluídas ({completionProgress}%)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleChecklistOpen(order.id)}
                  aria-expanded={isOpen}
                  aria-controls={`checklist-${order.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 cursor-pointer"
                >
                  <span>{isOpen ? '▲ Ocultar checklist' : '▼ Mostrar checklist'}</span>
                </button>
              </div>

              {/* CONTEÚDO DA CHECKLIST E BOTÃO DE FINALIZAR NO FIM */}
              {isOpen && (
                <div id={`checklist-${order.id}`} className="p-5 sm:p-6 space-y-6">
                  {Object.entries(groupedTasks).map(([category, tasks]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{category}</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {tasks.map((task) => (
                          <label key={task.id} className={`flex items-center gap-3 rounded-xl border p-3.5 transition cursor-pointer ${task.done ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                            <input
                              type="checkbox"
                              checked={task.done}
                              disabled={busy !== null || order.status === 'completed' || order.status === 'cancelled'}
                              onChange={() => void toggleTask(order, task.id)}
                              className="h-4 w-4 rounded border-slate-300 text-[#0B192C] focus:ring-[#00D4FF]"
                            />
                            <span className={`text-xs font-semibold leading-snug ${task.done ? 'line-through opacity-75' : ''}`}>{task.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* BOTÃO DE FINALIZAR LIMPEZA NO FINAL DO CHECKLIST */}
                  {order.status === 'in_progress' && (
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs font-medium text-slate-500">
                        {checklistComplete
                          ? '✓ Todas as tarefas estão concluídas. Já pode finalizar.'
                          : `⚠️ Conclua todas as tarefas (${completedTasks.length}/${checklist.length}) para finalizar.`}
                      </p>
                      <button
                        type="button"
                        disabled={busy !== null || !checklistComplete || Boolean(order.paused_at)}
                        onClick={() => void updateOrder(order, 'finish')}
                        className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <span>✓</span>
                        {busy === `finish-${order.id}` ? 'A finalizar...' : 'Finalizar limpeza'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          })}</div>}
        </main>
      </div>
    </div>
  )
}
