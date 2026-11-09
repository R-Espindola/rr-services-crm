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

const formatDuration = (totalSeconds: number) => {
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
  }
  return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
}

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
  
  // Novo estado para selecionar uma data específica no calendário interativo
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])

  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null)
  const [checklistOpen, setChecklistOpen] = useState<Record<string, boolean>>({})
  const [customTaskInput, setCustomTaskInput] = useState<Record<string, string>>({})

  const toggleChecklistOpen = (orderId: string) => {
    setChecklistOpen(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

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

      // Cálculo dinâmico do período baseado na vista (Hoje, Semana, Mês ou data customizada)
      const baseDate = new Date(selectedDate)
      baseDate.setHours(0, 0, 0, 0)
      
      if (agendaView === 'week') {
        baseDate.setDate(baseDate.getDate() - ((baseDate.getDay() + 6) % 7) + periodOffset * 7)
      } else if (agendaView === 'month') {
        baseDate.setDate(1)
        baseDate.setMonth(baseDate.getMonth() + periodOffset)
      } else {
        baseDate.setDate(baseDate.getDate() + periodOffset)
      }

      const start = new Date(baseDate)
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
  }, [agendaView, periodOffset, selectedDate])

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
      setError(rpcMessage.includes('start window opens')
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

  async function addCustomTask(order: Order) {
    const text = (customTaskInput[order.id] || '').trim()
    if (!text) return

    const newTask: ChecklistItem = {
      id: `custom-${Date.now()}`,
      category: '➕ Tarefas Adicionais / Extra',
      label: text,
      done: true
    }

    const updatedChecklist = [...(order.worker_checklist ?? []), newTask]
    const success = await saveChecklist(order, updatedChecklist)
    if (success) {
      setCustomTaskInput(prev => ({ ...prev, [order.id]: '' }))
    }
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

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F3F6FA] text-sm font-bold text-slate-500">A carregar a sua agenda...</main>
  if (error && !orders.length) return <main className="flex min-h-screen items-center justify-center bg-[#F3F6FA] px-6"><div className="max-w-md rounded-[28px] border border-rose-200 bg-white p-8 text-center shadow-xl"><p className="text-sm font-bold text-rose-600">{error}</p><Link href="/login" className="mt-5 inline-flex h-12 items-center rounded-2xl bg-[#0B192C] px-6 text-xs font-black text-white shadow-md hover:bg-slate-800 transition">Iniciar sessão</Link></div></main>

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#0B192C]">
      {/* Header Superior Moderno */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#081426]/90 backdrop-blur-xl text-white shadow-lg">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/trabalhador" className="flex items-center gap-3.5 group">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00D4FF] text-sm font-black text-[#0B192C] shadow-lg shadow-[#00D4FF]/20 group-hover:scale-105 transition">R&R</span>
            <div>
              <span className="block text-sm font-black tracking-wider">R&R SERVICES</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D4FF]">Portal do Trabalhador</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-semibold text-slate-300 sm:block bg-white/[0.06] px-3.5 py-2 rounded-xl border border-white/5">👤 {workerName}</span>
            <button type="button" onClick={signOut} className="h-11 rounded-xl border border-white/15 bg-white/[0.06] px-5 text-xs font-bold text-slate-200 hover:bg-white/15 hover:border-white/30 transition shadow-xs">Terminar sessão</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1550px] lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Sidebar Moderna */}
        <aside className="hidden border-r border-slate-200/80 bg-white/80 backdrop-blur-md px-5 py-8 lg:block min-h-[calc(100vh-5rem)]">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Navegação</p>
          <nav className="mt-4 space-y-2">
            <Link href="/trabalhador" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">🏠</span>Início (Dashboard)
            </Link>
            <Link href="/trabalhador/agenda" className="flex h-12 items-center gap-3.5 rounded-2xl bg-[#0B192C] px-4 text-xs font-bold text-white shadow-xl shadow-[#0B192C]/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00D4FF] text-[#0B192C] text-xs font-black">📅</span>Agenda de hoje
              <span className="ml-auto h-2 w-2 rounded-full bg-[#00D4FF]" />
            </Link>
            <Link href="/trabalhador/horas" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">⏱️</span>Horas trabalhadas
            </Link>
            <Link href="/trabalhador/perfil" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">🔒</span>Segurança / Perfil
            </Link>
          </nav>
          
          <div className="mt-12 rounded-3xl bg-gradient-to-br from-[#0B192C] to-[#173957] p-5 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-[#00D4FF]/10 blur-xl" />
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-sm text-[#0B192C] font-black">✦</span>
            <p className="mt-4 text-xs font-black tracking-wide">Bom trabalho!</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">Consulte os detalhes de cada visita e atualize o progresso ao longo do dia.</p>
          </div>
          <p className="mt-10 px-3 text-[10px] font-semibold text-slate-400">© 2026 R&R Services</p>
        </aside>

        {/* Conteúdo da Agenda com Calendário Interativo */}
        <main className="min-w-0 px-6 pb-24 pt-8 sm:px-10 lg:px-12 space-y-8">
          {/* Banner da Agenda */}
          <section className="relative isolate overflow-hidden rounded-[32px] bg-[#0B192C] p-8 text-white shadow-2xl sm:p-10">
            <div className="absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-[#00D4FF]/15 blur-3xl pointer-events-none" />
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#70E8FF]">
                  <span className="h-2 w-2 rounded-full bg-[#00D4FF] animate-pulse" /> Agenda Interativa
                </span>
                <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Bom dia, {workerName.split(/\s+/)[0] || 'Trabalhador'}<span className="text-[#00D4FF]">.</span></h1>
                <p className="mt-3 text-sm capitalize leading-relaxed text-slate-300 sm:text-base">{formatDate(selectedDate)}. Consulte o planeamento das suas visitas.</p>
              </div>
              <button type="button" onClick={() => void loadAgenda()} className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-white px-6 text-xs font-black text-[#0B192C] transition hover:bg-[#00D4FF] shadow-lg self-start sm:self-auto">
                <span>↻</span> Atualizar agenda
              </button>
            </div>
            
            <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
              {[
                [agendaView === 'today' ? 'Visitas do dia' : agendaView === 'week' ? 'Visitas esta semana' : 'Visitas este mês', counts.total, '📅'],
                ['Por iniciar', counts.pending, '⏳'],
                ['Em andamento', counts.active, '⚡'],
                ['Concluídas', counts.completed, '✅']
              ].map(([label, value, icon]) => (
                <div key={String(label)} className="flex items-center gap-4 bg-white/[0.05] backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-md">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF] text-lg font-black">{icon}</span>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                    <span className="mt-0.5 block text-lg font-black text-white">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* BARRA DE CALENDÁRIO INTERATIVO E FILTROS */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Seletor de Tipo de Vista (Hoje, Semana, Mês) */}
              <div role="tablist" aria-label="Período da agenda" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 max-w-sm">
                {([['today', 'Dia'], ['week', 'Semana'], ['month', 'Mês']] as const).map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={agendaView === view}
                    onClick={() => { setAgendaView(view); setPeriodOffset(0); }}
                    className={`h-10 rounded-xl text-xs font-black transition ${agendaView === view ? 'bg-[#0B192C] text-white shadow-md' : 'text-slate-600 hover:bg-slate-200/60'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Seletor de Data Interativo (Calendário Nativo) */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">🗓️ Escolher Data:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setPeriodOffset(0)
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>
            </div>

            {/* Controladores de Offset (Anterior, Seguinte, Hoje) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodOffset(offset => offset - 1)}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  ‹ Período Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodOffset(offset => offset + 1)}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  Período Seguinte ›
                </button>
              </div>

              {periodOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => { setPeriodOffset(0); setSelectedDate(new Date().toISOString().split('T')[0]); }}
                  className="h-10 px-4 rounded-xl bg-sky-50 border border-sky-200 text-xs font-extrabold text-sky-800 hover:bg-sky-100 transition"
                >
                  Voltar a Hoje
                </button>
              )}
            </div>
          </div>

          {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-sm">{error}</div>}
          {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700 shadow-sm">{notice}</div>}

          <div className="flex items-end justify-between gap-3 pt-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#00D4FF]">Rota de trabalho</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Visitas Agendadas</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 shadow-xs">{counts.total} {counts.total === 1 ? 'serviço' : 'serviços'}</span>
          </div>

          {/* Listagem de Ordens de Limpeza */}
          {orders.length === 0 ? (
            <div className="rounded-[32px] border border-slate-200 bg-white p-12 text-center shadow-sm">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-[#00D4FF] font-black mb-3">✓</span>
              <h3 className="font-extrabold text-slate-800 text-base">Sem visitas agendadas para este período</h3>
              <p className="mt-1.5 text-xs text-slate-500">Selecione outra data no calendário acima ou escolha a vista semanal/mensal.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const client = getClient(order.clients)
                const address = client.address?.trim() ?? ''
                const checklist = order.worker_checklist ?? []
                const completedTasks = checklist.filter((task) => task.done)
                const completionProgress = checklist.length ? Math.round((completedTasks.length / checklist.length) * 100) : 0

                const startAvailableAt = new Date(order.scheduled_date).getTime() - 5 * 60_000
                const canStartNow = clock >= startAvailableAt

                let elapsedSeconds = 0
                if (order.status === 'in_progress' && order.started_at) {
                  const startTime = new Date(order.started_at).getTime()
                  const pausedDurationMs = (order.paused_duration_seconds || 0) * 1000
                  
                  if (order.paused_at) {
                    const pauseTime = new Date(order.paused_at).getTime()
                    elapsedSeconds = Math.floor((pauseTime - startTime - pausedDurationMs) / 1000)
                  } else {
                    elapsedSeconds = Math.floor((clock - startTime - pausedDurationMs) / 1000)
                  }
                  if (elapsedSeconds < 0) elapsedSeconds = 0
                } else if (order.status === 'completed' && order.duration_minutes) {
                  elapsedSeconds = order.duration_minutes * 60
                }

                const destinationQuery = client.latitude !== null && client.longitude !== null ? `${client.latitude},${client.longitude}` : address || 'Portugal'
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationQuery)}`
                const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(destinationQuery)}&navigate=yes`
                const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(destinationQuery)}`

                const isOpen = checklistOpen[order.id] ?? false

                const status = order.status === 'pending' ? { label: 'Não iniciada', style: 'bg-amber-50 text-amber-700 border-amber-200' } : order.status === 'in_progress' && order.paused_at ? { label: 'Pausada', style: 'bg-violet-50 text-violet-700 border-violet-200' } : order.status === 'in_progress' ? { label: 'Em andamento', style: 'bg-sky-50 text-sky-700 border-sky-200' } : order.status === 'completed' ? { label: 'Concluída', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' } : { label: 'Cancelada', style: 'bg-rose-50 text-rose-700 border-rose-200' }

                const groupedTasks = checklist.reduce<Record<string, ChecklistItem[]>>((acc, task) => {
                  const cat = task.category || 'Outras Tarefas'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(task)
                  return acc
                }, {})

                return (
                  <article key={order.id} className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm hover:shadow-xl transition-all duration-300">
                    <div className="flex flex-col gap-6 border-b border-slate-100 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
                      <div className="flex min-w-0 gap-5">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0B192C] text-[#00D4FF] text-xl font-black shadow-md">🏠</span>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-black text-slate-900">{client.name || 'Cliente'}</h3>
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${status.style}`}>{status.label}</span>
                          </div>
                          <p className="text-xs font-extrabold text-slate-600">{order.service_type}</p>
                          <p className="text-xs font-semibold text-slate-400 capitalize">🕒 {formatTime(order.scheduled_date)} · {formatDate(order.scheduled_date)}</p>
                          
                          {order.status === 'in_progress' && (
                            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-[#0B192C] text-[#00D4FF] px-4 py-2.5 text-xs font-mono font-bold shadow-md">
                              <span className="h-2 w-2 rounded-full bg-[#00D4FF] animate-ping" />
                              <span>Tempo Trabalhado: {formatDuration(elapsedSeconds)}</span>
                              {order.paused_at && <span className="text-violet-300 text-[10px] font-sans font-normal uppercase tracking-wide ml-1">(Pausado)</span>}
                            </div>
                          )}

                          {order.status === 'completed' && elapsedSeconds > 0 && (
                            <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 text-emerald-800 px-4 py-2 text-xs font-mono font-bold border border-emerald-200">
                              <span>⏱️ Tempo total: {formatDuration(elapsedSeconds)}</span>
                            </div>
                          )}
                          
                          {client.phone && (
                            <div className="pt-1">
                              <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-sky-50 text-xs font-black text-sky-700 hover:bg-sky-100 transition">
                                📞 Ligar ao cliente · {client.phone}
                              </a>
                            </div>
                          )}

                          {order.notes?.trim() && (
                            <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950 font-medium">
                              <strong>Instruções do Administrador:</strong> {order.notes}
                            </p>
                          )}

                          {address && (
                            <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-700">📍 {address}</p>
                                <button type="button" onClick={() => copyAddressToClipboard(order.id, address)} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition shadow-2xs">
                                  {copiedAddressId === order.id ? '✓ Morada copiada!' : '📋 Copiar morada'}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs">🗺️ Google Maps</a>
                                <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs">🚗 Waze</a>
                                <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs">🍎 Apple Maps</a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {order.status === 'pending' && (
                        <div className="w-full sm:w-auto sm:min-w-56 space-y-2">
                          <button type="button" disabled={busy !== null || !canStartNow} onClick={() => void updateOrder(order, 'start')} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B192C] px-6 text-xs font-black text-white shadow-lg hover:bg-slate-800 disabled:opacity-55 disabled:cursor-not-allowed transition">
                            <span aria-hidden="true">▶</span>
                            {busy === `start-${order.id}` ? 'A iniciar...' : !canStartNow ? 'Aguardar horário' : 'Iniciar limpeza'}
                          </button>
                          {!canStartNow && <p className="text-center text-[10px] font-bold text-amber-600">Disponível às {formatTime(new Date(startAvailableAt).toISOString())}</p>}
                        </div>
                      )}

                      {order.status === 'in_progress' && (
                        <div className="w-full sm:w-auto sm:min-w-56">
                          {order.paused_at ? (
                            <button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'resume')} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-xs font-black text-white hover:bg-violet-700 transition shadow-md">▶ Retomar limpeza</button>
                          ) : (
                            <button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'pause')} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-6 text-xs font-black text-violet-700 hover:bg-violet-100 transition shadow-xs">⏸ Pausar limpeza</button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Barra do Acordeão da Checklist */}
                    <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">📋 Checklist de Tarefas</span>
                        <span className="rounded-full bg-[#00D4FF]/20 px-3 py-0.5 text-[11px] font-black text-[#0B192C]">
                          {completedTasks.length} / {checklist.length} concluídas ({completionProgress}%)
                        </span>
                      </div>
                      <button type="button" onClick={() => toggleChecklistOpen(order.id)} aria-expanded={isOpen} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs">
                        <span>{isOpen ? '▲ Ocultar checklist' : '▼ Mostrar checklist'}</span>
                      </button>
                    </div>

                    {isOpen && (
                      <div id={`checklist-${order.id}`} className="p-6 sm:p-8 space-y-6 bg-white">
                        {Object.entries(groupedTasks).map(([category, tasks]) => (
                          <div key={category} className="space-y-3">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">{category}</h4>
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              {tasks.map((task) => (
                                <label key={task.id} className={`flex items-center gap-3.5 rounded-2xl border p-4 transition cursor-pointer ${task.done ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950 font-bold' : 'border-slate-200 hover:border-slate-300'}`}>
                                  <input type="checkbox" checked={task.done} disabled={busy !== null || order.status === 'completed' || order.status === 'cancelled'} onChange={() => void toggleTask(order, task.id)} className="h-4 w-4 rounded border-slate-300 text-[#0B192C] focus:ring-[#00D4FF]" />
                                  <span className={`text-xs font-semibold leading-snug ${task.done ? 'line-through opacity-75' : 'text-slate-700'}`}>{task.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Adicionar Tarefa Extra Personalizada */}
                        {order.status === 'in_progress' && (
                          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                            <input
                              type="text"
                              placeholder="Adicionar tarefa extra (ex: Limpar vidros da varanda)..."
                              value={customTaskInput[order.id] || ''}
                              onChange={(e) => setCustomTaskInput(prev => ({ ...prev, [order.id]: e.target.value }))}
                              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
                            />
                            <button
                              type="button"
                              onClick={() => void addCustomTask(order)}
                              disabled={busy !== null || !(customTaskInput[order.id] || '').trim()}
                              className="h-11 rounded-2xl bg-[#0B192C] px-5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-md"
                            >
                              + Adicionar tarefa
                            </button>
                          </div>
                        )}

                        {/* Botão de Finalizar Limpeza */}
                        {order.status === 'in_progress' && (
                          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-xs font-semibold text-slate-500">
                              ℹ️ Pode marcar o que foi realizado e finalizar o serviço quando terminar.
                            </p>
                            <button
                              type="button"
                              disabled={busy !== null || Boolean(order.paused_at)}
                              onClick={() => void updateOrder(order, 'finish')}
                              className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-lg"
                            >
                              <span>✓</span>
                              {busy === `finish-${order.id}` ? 'A finalizar...' : 'Finalizar limpeza'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}