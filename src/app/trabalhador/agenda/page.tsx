'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { marcarDeslocacao } from './actions'

type ChecklistItem = { id: string; category?: string; label: string; done: boolean }
type ClientInfo = {
  name: string | null
  address: string | null
  floor_details: string | null
  phone: string | null
  latitude: number | null
  longitude: number | null
}
type PropertyInfo = {
  label: string | null
  street_address: string | null
  postal_code: string | null
  city: string | null
  reference_notes: string | null
  access_instructions: string | null
  cleaning_notes: string | null
  company_provides_supplies: boolean | null
}
type Order = {
  id: string
  client_id: string
  service_type: string
  scheduled_date: string
  status: 'pending' | 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled'
  property_id: string | null
  arrival_window_start: string | null
  arrival_window_end: string | null
  notes: string | null
  worker_notes: string | null
  started_at: string | null
  completed_at: string | null
  duration_minutes: number | null
  paused_at: string | null
  paused_duration_seconds: number
  worker_checklist: ChecklistItem[] | null
  incident_photos: string[] | null
  clients: ClientInfo | ClientInfo[] | null
  properties: PropertyInfo | PropertyInfo[] | null
}

type IncidentPhoto = { path: string; url: string }

type VisitSummary = {
  order: Order
  checklist: ChecklistItem[]
  durationSeconds: number
}

const defaultTasks = (): ChecklistItem[] => {
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
  ? client[0] ?? { name: null, address: null, floor_details: null, phone: null, latitude: null, longitude: null }
  : client ?? { name: null, address: null, floor_details: null, phone: null, latitude: null, longitude: null }
const getProperty = (property: Order['properties']): PropertyInfo | null => Array.isArray(property) ? property[0] ?? null : property
const formatWindowTime = (value: string | null) => value ? value.slice(0, 5) : null

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

const formatRemaining = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`
}

function sharePhoneNumber(phone: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9) digits = `351${digits}`
  return digits
}

function visitSummaryMessage(summary: VisitSummary) {
  const client = getClient(summary.order.clients)
  const completedTasks = summary.checklist.filter((task) => task.done)
  const taskList = completedTasks.length
    ? completedTasks.map((task) => `• ${task.label}`).join('\n')
    : '• Sem tarefas assinaladas.'

  return [
    `Olá ${client.name || 'Cliente'}, a limpeza de ${summary.order.service_type} foi concluída.`,
    `Estado da visita: Concluída.`,
    `Tempo de trabalho: ${formatDuration(summary.durationSeconds)}.`,
    '',
    'Tarefas executadas:',
    taskList,
    summary.order.worker_notes?.trim() ? `\nObservações: ${summary.order.worker_notes.trim()}` : '',
    '',
    'Obrigado pela confiança na R&R Services.',
  ].filter(Boolean).join('\n')
}

export default function WorkerAgendaPage() {
  const router = useRouter()
  const [workerName, setWorkerName] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [clock, setClock] = useState(0)
  const [agendaView, setAgendaView] = useState<'today' | 'week' | 'month'>('today')
  const [periodOffset, setPeriodOffset] = useState(0)
  
  // Novo estado para selecionar uma data específica no calendário interativo
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])

  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null)
  const [checklistOpen, setChecklistOpen] = useState<Record<string, boolean>>({})
  const [customTaskInput, setCustomTaskInput] = useState<Record<string, string>>({})
  const [incidentNotes, setIncidentNotes] = useState<Record<string, string>>({})
  const [savedIncidentNotes, setSavedIncidentNotes] = useState<Record<string, boolean>>({})
  const [incidentPhotoUrls, setIncidentPhotoUrls] = useState<Record<string, IncidentPhoto[]>>({})
  const [visitSummary, setVisitSummary] = useState<VisitSummary | null>(null)

  const toggleChecklistOpen = (orderId: string) => {
    setChecklistOpen(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  useEffect(() => {
    const updateClock = () => setClock(Date.now())
    const initialUpdate = window.setTimeout(updateClock, 0)
    const timer = window.setInterval(updateClock, 1000)
    return () => {
      window.clearTimeout(initialUpdate)
      window.clearInterval(timer)
    }
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
        .select('id, client_id, service_type, scheduled_date, status, property_id, arrival_window_start, arrival_window_end, notes, worker_notes, started_at, completed_at, duration_minutes, paused_at, paused_duration_seconds, worker_checklist, incident_photos, clients!orders_client_id_fkey(name, address, floor_details, phone, latitude, longitude), properties!orders_property_id_fkey(label, street_address, postal_code, city, reference_notes, access_instructions, cleaning_notes, company_provides_supplies)')
        .eq('worker_user_id', user.id)
        .gte('scheduled_date', start.toISOString())
        .lt('scheduled_date', end.toISOString())
        .order('scheduled_date', { ascending: true })

      if (ordersError) throw ordersError

      const rows = ((data ?? []) as unknown as Order[]).map((order) => ({
        ...order,
        worker_checklist: order.worker_checklist?.length ? order.worker_checklist : defaultTasks(),
      }))
      setOrders(rows)
      let photoLoadFailed = false
      const photoGroups = await Promise.all(rows.map(async (order) => {
        const signedPhotos = await Promise.all((order.incident_photos ?? []).map(async (path) => {
          const { data: signedPhoto, error: signedPhotoError } = await supabase.storage
            .from('worker-cleaning-photos')
            .createSignedUrl(path, 60 * 60)
          if (signedPhotoError || !signedPhoto) {
            photoLoadFailed = true
            return null
          }
          return { path, url: signedPhoto.signedUrl }
        }))
        return [order.id, signedPhotos.filter((photo): photo is IncidentPhoto => photo !== null)] as const
      }))
      setIncidentPhotoUrls(Object.fromEntries(photoGroups))
      if (photoLoadFailed) setError('Algumas fotografias não puderam ser carregadas. Atualize a agenda para tentar novamente.')

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
    pending: orders.filter((order) => order.status === 'pending' || order.status === 'confirmed').length,
    enRoute: orders.filter((order) => order.status === 'en_route').length,
    active: orders.filter((order) => order.status === 'in_progress').length,
    completed: orders.filter((order) => order.status === 'completed').length,
  }), [orders])

  async function markEnRoute(order: Order) {
    setBusy(`en-route-${order.id}`)
    setError('')
    const result = await marcarDeslocacao(order.id)
    if (!result.success) setError(result.error)
    else {
      setNotice('Estado atualizado: equipa a caminho.')
      await loadAgenda()
    }
    setBusy(null)
  }

  async function updateOrder(order: Order, action: 'start' | 'pause' | 'resume' | 'finish') {
    setBusy(`${action}-${order.id}`)
    setNotice('')
    setError('')
    try {
      if (action === 'finish') {
        const notes = incidentNotes[order.id] ?? order.worker_notes ?? ''
        const { error: notesError } = await supabase.rpc('worker_save_incident_notes', {
          p_order_id: order.id,
          p_notes: notes,
        })
        if (notesError) throw notesError

        const { data: completion, error: finishError } = await supabase.rpc('worker_finish_cleaning', { p_order_id: order.id })
        if (finishError) throw finishError

        const durationMinutes = typeof completion?.duration_minutes === 'number' ? completion.duration_minutes : 0
        const completedAt = typeof completion?.completed_at === 'string' ? completion.completed_at : new Date().toISOString()
        const completedOrder: Order = {
          ...order,
          status: 'completed',
          completed_at: completedAt,
          duration_minutes: durationMinutes,
          worker_notes: notes.trim(),
        }
        const summary = { order: completedOrder, checklist: order.worker_checklist ?? [], durationSeconds: durationMinutes * 60 }
        setOrders((current) => current.map((item) => item.id === order.id ? completedOrder : item))
        setVisitSummary(summary)
        setSavedIncidentNotes((current) => ({ ...current, [order.id]: true }))
        setNotice('Visita concluída. O resumo está pronto para partilhar com o cliente.')
      } else {
        const rpcName = { start: 'worker_start_cleaning', pause: 'worker_pause_cleaning', resume: 'worker_resume_cleaning' }[action]
        const { error: rpcError } = await supabase.rpc(rpcName, { p_order_id: order.id })
        if (rpcError) throw rpcError
        setNotice({ start: 'Serviço iniciado. Bom trabalho!', pause: 'Cronómetro pausado.', resume: 'Cronómetro retomado.' }[action])
        await loadAgenda()
      }
    } catch (cause) {
      const rpcMessage = typeof cause === 'object' && cause !== null && 'message' in cause ? String(cause.message) : ''
      setError(rpcMessage.includes('start window opens')
        ? 'O início fica disponível 10 minutos antes do horário agendado.'
        : 'Não foi possível atualizar o estado da limpeza. Atualize a página e tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function saveIncidentNotes(order: Order) {
    const notes = incidentNotes[order.id] ?? order.worker_notes ?? ''
    setBusy(`notes-${order.id}`)
    setError('')
    try {
      const { error: notesError } = await supabase.rpc('worker_save_incident_notes', {
        p_order_id: order.id,
        p_notes: notes,
      })
      if (notesError) throw notesError
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, worker_notes: notes.trim() } : item))
      setSavedIncidentNotes((current) => ({ ...current, [order.id]: true }))
      setNotice('Observação guardada no registo da visita.')
    } catch {
      setSavedIncidentNotes((current) => ({ ...current, [order.id]: false }))
      setError('Não foi possível guardar a observação. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function uploadIncidentPhoto(order: Order, file: File | null) {
    if (!file) return
    if ((order.incident_photos?.length ?? 0) >= 10) {
      setError('O limite é de 10 fotografias de ocorrência por limpeza.')
      return
    }
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    }
    const extension = extensionByType[file.type]
    if (!extension || file.size > 8 * 1024 * 1024) {
      setError('Escolha uma foto JPG, PNG, WebP ou HEIC com, no máximo, 8 MB.')
      return
    }

    setBusy(`photo-${order.id}`)
    setError('')
    setNotice('')
    let uploadedPath: string | null = null
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('A sua sessão terminou. Inicie sessão novamente.')

      const photoPath = `${user.id}/${order.id}/incident/${crypto.randomUUID()}.${extension}`
      uploadedPath = photoPath
      const { error: uploadError } = await supabase.storage
        .from('worker-cleaning-photos')
        .upload(photoPath, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError

      const { error: attachError } = await supabase.rpc('worker_attach_photo', {
        p_order_id: order.id,
        p_photo_type: 'incident',
        p_storage_path: photoPath,
      })
      if (attachError) {
        const { error: cleanupError } = await supabase.storage
          .from('worker-cleaning-photos')
          .remove([photoPath])
        if (cleanupError) console.error('Não foi possível remover uma fotografia de ocorrência não associada:', cleanupError.message)
        uploadedPath = null
        throw attachError
      }

      const savedPath = photoPath
      uploadedPath = null
      setOrders((current) => current.map((item) => item.id === order.id
        ? { ...item, incident_photos: [...(item.incident_photos ?? []), savedPath] }
        : item))
      const { data: signedPhoto, error: signedPhotoError } = await supabase.storage
        .from('worker-cleaning-photos')
        .createSignedUrl(savedPath, 60 * 60)
      if (signedPhotoError || !signedPhoto) {
        setNotice('Fotografia guardada. Não foi possível criar a pré-visualização; atualize a agenda para a consultar.')
      } else {
        setIncidentPhotoUrls((current) => ({
          ...current,
          [order.id]: [...(current[order.id] ?? []), { path: savedPath, url: signedPhoto.signedUrl }],
        }))
        setNotice('Fotografia de ocorrência guardada.')
      }
    } catch (cause) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from('worker-cleaning-photos')
          .remove([uploadedPath])
        if (cleanupError) console.error('Não foi possível remover uma fotografia de ocorrência não associada:', cleanupError.message)
      }
      setError(cause instanceof Error && cause.message !== 'Failed to fetch'
        ? cause.message
        : 'Não foi possível guardar a fotografia. Verifique a ligação e tente novamente.')
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

  const summaryClient = visitSummary ? getClient(visitSummary.order.clients) : null
  const summaryText = visitSummary ? visitSummaryMessage(visitSummary) : ''
  const summaryPhone = summaryClient?.phone?.trim() ?? ''
  const whatsappNumber = summaryPhone ? sharePhoneNumber(summaryPhone) : ''
  const whatsappShareUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(summaryText)}` : ''
  const smsRecipient = summaryPhone.replace(/[^\d+]/g, '')
  const smsShareUrl = smsRecipient ? `sms:${smsRecipient}?body=${encodeURIComponent(summaryText)}` : ''

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#0B192C]">
      {/* Header Superior Moderno */}
      <header className="hidden">
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

      <div className="contents">
        {/* Sidebar Moderna */}
        <aside className="hidden">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Navegação</p>
          <nav className="mt-4 space-y-2">
            <Link href="/trabalhador" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">🏠</span>Início (Dashboard)
            </Link>
            <Link href="/trabalhador/agenda" className="flex h-12 items-center gap-3.5 rounded-2xl bg-[#0B192C] px-4 text-xs font-bold text-white shadow-xl shadow-[#0B192C]/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00D4FF] text-[#0B192C] text-xs font-black">📅</span>Agenda de hoje
              <span className="ml-auto h-2 w-2 rounded-full bg-[#00D4FF]" />
            </Link>
            <Link href="/trabalhador/turno" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">⏱️</span>Turno e pausas
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
                const property = getProperty(order.properties)
                const cleanAddress = (value: string | null | undefined) => value?.replace(/[\s,]+$/, '').trim() || ''
                const propertyAddress = property
                  ? [property.street_address, property.postal_code, property.city].map(cleanAddress).filter(Boolean).join(', ')
                  : ''
                const baseAddress = propertyAddress || cleanAddress(client.address)
                const floorDetails = cleanAddress(client.floor_details)
                const fullAddress = [baseAddress, floorDetails].filter(Boolean).join(' · ')
                const checklist = order.worker_checklist ?? []
                const completedTasks = checklist.filter((task) => task.done)
                const completionProgress = checklist.length ? Math.round((completedTasks.length / checklist.length) * 100) : 0

                const startAvailableAt = new Date(order.scheduled_date).getTime() - 10 * 60_000
                const canStartNow = clock >= startAvailableAt
                const secondsUntilStart = Math.max(0, Math.ceil((startAvailableAt - clock) / 1000))

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

                const destinationQuery = client.latitude !== null && client.longitude !== null ? `${client.latitude},${client.longitude}` : baseAddress || 'Portugal'
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationQuery)}`
                const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(destinationQuery)}&navigate=yes`
                const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(destinationQuery)}`

                const isOpen = checklistOpen[order.id] ?? false

                const status = order.status === 'pending' ? { label: 'Não iniciada', style: 'bg-amber-50 text-amber-700 border-amber-200' } : order.status === 'confirmed' ? { label: 'Confirmada', style: 'bg-blue-50 text-blue-700 border-blue-200' } : order.status === 'en_route' ? { label: 'A caminho', style: 'bg-cyan-50 text-cyan-700 border-cyan-200' } : order.status === 'in_progress' && order.paused_at ? { label: 'Pausada', style: 'bg-violet-50 text-violet-700 border-violet-200' } : order.status === 'in_progress' ? { label: 'Em andamento', style: 'bg-sky-50 text-sky-700 border-sky-200' } : order.status === 'completed' ? { label: 'Concluída', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' } : { label: 'Cancelada', style: 'bg-rose-50 text-rose-700 border-rose-200' }

                const groupedTasks = checklist.reduce<Record<string, ChecklistItem[]>>((acc, task) => {
                  const cat = task.category || 'Outras Tarefas'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(task)
                  return acc
                }, {})

                return (
                  <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all duration-300 hover:shadow-xl">
                    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 gap-5">
                        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-[#061121] px-3.5 py-2 text-center text-white shadow-md"><span className="text-lg font-extrabold tabular-nums text-cyan-400">{formatTime(order.scheduled_date)}</span><span className="text-[11px] text-slate-300">{new Date(order.scheduled_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span></div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900">{client.name || 'Cliente'}</h3>
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${status.style}`}>{status.label}</span>
                          </div>
                          <p className="text-xs font-extrabold text-slate-600">{order.service_type}</p>
                          <p className="text-xs font-semibold capitalize text-slate-400">{formatDate(order.scheduled_date)}</p>
                          {(order.arrival_window_start || order.arrival_window_end) && <p className="text-xs font-bold text-cyan-700">Janela de chegada: {formatWindowTime(order.arrival_window_start) ?? '--:--'} – {formatWindowTime(order.arrival_window_end) ?? '--:--'}</p>}
                          {property?.label && <p className="text-xs font-bold text-slate-700">Imóvel: {property.label}</p>}
                          
                          {order.status === 'in_progress' && (
                            <div className="mt-3 inline-flex min-w-56 items-center gap-3 rounded-2xl border border-cyan-300/15 bg-gradient-to-r from-[#0B192C] to-[#12314a] px-4 py-3 text-white shadow-sm">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${order.paused_at ? 'bg-violet-300' : 'animate-pulse bg-[#00D4FF]'}`} />
                              <span>
                                <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-slate-300">{order.paused_at ? 'Cronómetro em pausa' : 'Tempo trabalhado'}</span>
                                <span className="mt-0.5 block font-mono text-lg font-bold tracking-wide text-[#7ceaff]">{formatDuration(elapsedSeconds)}</span>
                              </span>
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

                          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
                          {baseAddress && (
                            <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3 lg:col-span-7">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">📍 {baseAddress}</p>{floorDetails && <span className="mt-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-900">🏢 Andar / Porta: {floorDetails}</span>}</div>
                                <button type="button" onClick={() => copyAddressToClipboard(order.id, fullAddress)} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition shadow-2xs">
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
                          {(property?.access_instructions || property?.cleaning_notes || property?.company_provides_supplies !== null) && (
                            <div className="space-y-2.5 rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-4 text-xs lg:col-span-5">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-800">Preparação &amp; imóvel</p>
                              <p className="font-bold text-cyan-900">{property?.company_provides_supplies === false ? 'Usar produtos/equipamentos do cliente' : 'Levar produtos e equipamentos R&R'}</p>
                              {property?.reference_notes && <p className="whitespace-pre-wrap leading-relaxed text-slate-700"><strong>Referência:</strong> {property.reference_notes}</p>}
                              {property?.access_instructions && <p className="whitespace-pre-wrap leading-relaxed text-slate-700"><strong>Acesso:</strong> {property.access_instructions}</p>}
                              {property?.cleaning_notes && <p className="whitespace-pre-wrap leading-relaxed text-slate-700"><strong>Notas de limpeza:</strong> {property.cleaning_notes}</p>}
                            </div>
                          )}
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-56 lg:shrink-0">
                      {(order.status === 'confirmed' || order.status === 'en_route') && (
                        <div className="w-full space-y-2">
                          {order.status === 'confirmed' ? <button type="button" disabled={busy !== null} onClick={() => void markEnRoute(order)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 text-xs font-black text-[#0B192C] shadow-lg hover:bg-cyan-400 disabled:opacity-55 disabled:cursor-wait transition">
                            <span aria-hidden="true">➜</span>{busy === `en-route-${order.id}` ? 'A atualizar...' : 'Iniciar deslocação / A caminho'}
                          </button> : <div className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300 bg-cyan-50 px-6 text-xs font-black text-cyan-800"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />A caminho</div>}
                        </div>
                      )}

                      {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'en_route') && (
                        <div className="w-full space-y-2">
                          <button type="button" disabled={busy !== null || !canStartNow} onClick={() => void updateOrder(order, 'start')} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B192C] px-6 text-xs font-black text-white shadow-lg hover:bg-slate-800 disabled:opacity-55 disabled:cursor-not-allowed transition">
                            <span aria-hidden="true">▶</span>
                            {busy === `start-${order.id}` ? 'A iniciar...' : !canStartNow ? `Disponível em ${formatRemaining(secondsUntilStart)}` : 'Iniciar Serviço'}
                          </button>
                          {!canStartNow && <p className="text-center text-[10px] font-medium text-slate-500">Pode iniciar até 10 minutos antes da hora marcada.</p>}
                        </div>
                      )}

                      {order.status === 'in_progress' && (
                        <div className="w-full">
                          {order.paused_at ? (
                            <button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'resume')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-xs font-black text-white hover:bg-violet-700 transition shadow-md">▶ Retomar Serviço</button>
                          ) : (
                            <button type="button" disabled={busy !== null} onClick={() => void updateOrder(order, 'pause')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-6 text-xs font-black text-violet-700 hover:bg-violet-100 transition shadow-xs">⏸ Pausar Serviço</button>
                          )}
                        </div>
                      )}
                      </div>
                    </div>

                    {/* Barra do Acordeão da Checklist */}
                     <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50 px-5 py-3.5 sm:px-6">
                      <div className="flex items-center gap-3">
                         <span className="hidden text-xs font-black uppercase tracking-wider text-slate-700 sm:inline">📋 Checklist de Tarefas</span>
                         <span className="rounded-full bg-[#00D4FF]/20 px-3 py-0.5 text-[11px] font-black tabular-nums text-[#0B192C]">
                          {completedTasks.length} / {checklist.length} concluídas ({completionProgress}%)
                        </span>
                         <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${completionProgress}%` }} /></span>
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

                        {order.status === 'in_progress' && (
                          <section className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 sm:p-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h4 className="text-xs font-black text-[#0B192C]">Incidências e observações</h4>
                                <p className="mt-1 text-[11px] leading-5 text-slate-600">Registe danos, anomalias ou detalhes importantes encontrados no local.</p>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500">
                                {savedIncidentNotes[order.id] ?? Boolean(order.worker_notes?.trim()) ? 'Guardada' : 'Opcional'}
                              </span>
                            </div>
                            <label className="sr-only" htmlFor={`incident-notes-${order.id}`}>Incidências e observações da visita</label>
                            <textarea
                              id={`incident-notes-${order.id}`}
                              rows={3}
                              maxLength={2000}
                              value={incidentNotes[order.id] ?? order.worker_notes ?? ''}
                              onChange={(event) => {
                                setIncidentNotes((current) => ({ ...current, [order.id]: event.target.value }))
                                setSavedIncidentNotes((current) => ({ ...current, [order.id]: false }))
                              }}
                              placeholder="Ex.: torneira com fuga na casa de banho..."
                              className="mt-3 min-h-24 w-full resize-y rounded-xl border border-amber-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            />
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void saveIncidentNotes(order)}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
                              >
                                {busy === `notes-${order.id}` ? 'A guardar...' : 'Guardar observação'}
                              </button>
                            </div>
                            <div className="mt-4 border-t border-amber-200 pt-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h5 className="text-xs font-black text-[#0B192C]">Fotografias de ocorrência</h5>
                                  <p className="mt-1 text-[11px] text-slate-600">Até 10 fotografias · JPG, PNG, WebP ou HEIC · máximo 8 MB cada.</p>
                                </div>
                                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-xs font-bold text-amber-900 transition hover:bg-amber-50">
                                  {busy === `photo-${order.id}` ? 'A guardar fotografia...' : 'Adicionar fotografia'}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/heic"
                                    disabled={busy !== null}
                                    className="sr-only"
                                    onChange={(event) => {
                                      void uploadIncidentPhoto(order, event.currentTarget.files?.[0] ?? null)
                                      event.currentTarget.value = ''
                                    }}
                                  />
                                </label>
                              </div>
                              {(incidentPhotoUrls[order.id]?.length ?? 0) > 0 && (
                                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {incidentPhotoUrls[order.id].map((photo) => (
                                    <li key={photo.path}>
                                      <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-amber-200 bg-white">
                                        <Image src={photo.url} alt="Fotografia de ocorrência desta limpeza" width={640} height={400} unoptimized className="h-32 w-full object-cover" />
                                        <span className="block px-2 py-1.5 text-center text-[10px] font-bold text-slate-600">Ver fotografia</span>
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </section>
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
                              {busy === `finish-${order.id}` ? 'A finalizar...' : 'Finalizar Serviço'}
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
      {visitSummary && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#071326]/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setVisitSummary(null)
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="visit-summary-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/70 bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Visita concluída</span>
                <h2 id="visit-summary-title" className="mt-3 text-xl font-black tracking-tight text-[#0B192C]">Resumo da limpeza</h2>
                <p className="mt-1 text-sm text-slate-500">{summaryClient?.name || 'Cliente'} · {visitSummary.order.service_type}</p>
              </div>
              <button type="button" aria-label="Fechar resumo" onClick={() => setVisitSummary(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50">×</button>
            </div>
            <div className="mt-5 rounded-2xl bg-[#0B192C] p-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Tempo total trabalhado</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-[#7ceaff]">{formatDuration(visitSummary.durationSeconds)}</p>
            </div>
            <div className="mt-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Tarefas executadas · {visitSummary.checklist.filter((task) => task.done).length}</h3>
              {visitSummary.checklist.some((task) => task.done) ? (
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {visitSummary.checklist.filter((task) => task.done).map((task) => <li key={task.id} className="flex gap-2.5 rounded-xl bg-emerald-50/70 px-3 py-2.5 text-sm text-emerald-950"><span aria-hidden="true" className="font-bold text-emerald-600">✓</span><span>{task.label}</span></li>)}
                </ul>
              ) : <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Nenhuma tarefa foi assinalada nesta visita.</p>}
            </div>
            {visitSummary.order.worker_notes?.trim() && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5"><h3 className="text-[10px] font-black uppercase tracking-wider text-amber-800">Observações</h3><p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-amber-950">{visitSummary.order.worker_notes}</p></div>}
            <p className="mt-4 text-xs text-slate-500">Estado da visita: <span className="font-bold text-emerald-700">Concluída</span></p>
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {whatsappShareUrl && <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#128C7E] px-4 text-sm font-bold text-white transition hover:bg-[#0e776b]">Partilhar por WhatsApp</a>}
              {smsShareUrl && <a href={smsShareUrl} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#0B192C] transition hover:bg-slate-50">Enviar por SMS</a>}
              {!summaryPhone && <p className="col-span-full rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">Este cliente não tem número de telefone registado para partilha.</p>}
            </div>
            <button type="button" onClick={() => setVisitSummary(null)} className="mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-slate-500 transition hover:bg-slate-50">Fechar resumo</button>
          </section>
        </div>
      )}
    </div>
  )
}
