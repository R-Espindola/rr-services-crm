'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ClientInfo = {
  name: string | null
  address: string | null
  phone: string | null
}

type Order = {
  id: string
  client_id: string
  service_type: string
  scheduled_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  clients: ClientInfo | ClientInfo[] | null
}

const getClient = (client: Order['clients']): ClientInfo => Array.isArray(client)
  ? client[0] ?? { name: null, address: null, phone: null }
  : client ?? { name: null, address: null, phone: null }

const formatTime = (value: string) => new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

export default function WorkerDashboardPage() {
  const router = useRouter()
  const [workerName, setWorkerName] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.replace('/login')
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
      const end = new Date(start)
      end.setDate(end.getDate() + 1)

      const { data, error: ordersError } = await supabase.from('orders')
        .select('id, client_id, service_type, scheduled_date, status, clients(name, address, phone)')
        .eq('worker_user_id', user.id)
        .gte('scheduled_date', start.toISOString())
        .lt('scheduled_date', end.toISOString())
        .order('scheduled_date', { ascending: true })

      if (ordersError) throw ordersError
      setOrders((data ?? []) as unknown as Order[])

    } catch {
      setError('Não foi possível carregar o painel. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F3F6FA] text-sm font-bold text-slate-500">A carregar painel...</main>

  const totalHoje = orders.length
  const concluidasHoje = orders.filter(o => o.status === 'completed').length
  const emAndamentoHoje = orders.find(o => o.status === 'in_progress')
  const proximaVisita = orders.find(o => o.status === 'pending')

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#0B192C]">
      {/* Header Superior Moderno com Glassmorphism */}
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
            <Link href="/trabalhador" className="flex h-12 items-center gap-3.5 rounded-2xl bg-[#0B192C] px-4 text-xs font-bold text-white shadow-xl shadow-[#0B192C]/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00D4FF] text-[#0B192C] text-xs font-black">🏠</span>Início (Dashboard)
              <span className="ml-auto h-2 w-2 rounded-full bg-[#00D4FF]" />
            </Link>
            <Link href="/trabalhador/agenda" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">📅</span>Agenda de hoje
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
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">Aceda rapidamente à sua agenda e controlo de ponto em tempo real.</p>
          </div>
          <p className="mt-10 px-3 text-[10px] font-semibold text-slate-400">© 2026 R&R Services</p>
        </aside>

        {/* Conteúdo Principal do Dashboard */}
        <main className="min-w-0 px-6 pb-24 pt-8 sm:px-10 lg:px-12 space-y-8">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-sm">{error}</div>}

          {/* Banner de Boas-Vindas Refinado */}
          <section className="relative isolate overflow-hidden rounded-[32px] bg-[#0B192C] p-8 text-white shadow-2xl sm:p-10">
            <div className="absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-[#00D4FF]/15 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-28 -z-10 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
            
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#70E8FF]">
                <span className="h-2 w-2 rounded-full bg-[#00D4FF] animate-pulse" /> Painel Operacional
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Olá, {workerName || 'Trabalhador'} 👋</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">Aqui tem o resumo completo das suas atividades e limpezas agendadas para hoje.</p>
            </div>

            {/* Cartões de Estatísticas Modernos */}
            <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
              <div className="flex items-center gap-4 bg-white/[0.05] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D4FF]/15 text-[#00D4FF] text-xl font-black">📅</span>
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Total Hoje</span>
                  <span className="mt-0.5 block text-xl font-black text-white">{totalHoje} <span className="text-xs font-medium text-slate-300">serviços</span></span>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white/[0.05] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 text-xl font-black">✅</span>
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Concluídas</span>
                  <span className="mt-0.5 block text-xl font-black text-white">{concluidasHoje} <span className="text-xs font-medium text-slate-300">/ {totalHoje}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white/[0.05] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D4FF]/15 text-[#00D4FF] text-xl font-black">⚡</span>
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Estado Atual</span>
                  <span className="mt-0.5 block text-sm font-extrabold text-[#00D4FF]">
                    {emAndamentoHoje ? 'Em Limpeza Ativa' : 'Disponível'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Cartões de Navegação Moderna */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/trabalhador/agenda" className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-xl hover:border-[#00D4FF] transition-all duration-300">
              <div className="absolute top-0 right-0 h-32 w-32 bg-sky-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B192C] text-[#00D4FF] text-xl font-black shadow-md">🗓️</span>
              <h3 className="relative z-10 mt-5 text-base font-black text-slate-900 group-hover:text-[#0B192C] transition">Ver Agenda Completa</h3>
              <p className="relative z-10 mt-2 text-xs leading-relaxed text-slate-500">Consulte escalas, moradas, links de navegação e checklists detalhadas.</p>
              <div className="relative z-10 mt-5 flex items-center gap-1.5 text-xs font-bold text-[#0B192C] group-hover:translate-x-1 transition-transform">
                Aceder à agenda →
              </div>
            </Link>

            <Link href="/trabalhador/horas" className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-xl hover:border-[#00D4FF] transition-all duration-300">
              <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B192C] text-[#00D4FF] text-xl font-black shadow-md">⏱️</span>
              <h3 className="relative z-10 mt-5 text-base font-black text-slate-900 group-hover:text-[#0B192C] transition">Controlo de Horas</h3>
              <p className="relative z-10 mt-2 text-xs leading-relaxed text-slate-500">Acompanhe o registo das suas entradas, saídas e total de horas cumpridas.</p>
              <div className="relative z-10 mt-5 flex items-center gap-1.5 text-xs font-bold text-[#0B192C] group-hover:translate-x-1 transition-transform">
                Ver histórico de horas →
              </div>
            </Link>

            <Link href="/trabalhador/perfil" className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-xl hover:border-[#00D4FF] transition-all duration-300">
              <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform duration-300" />
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B192C] text-[#00D4FF] text-xl font-black shadow-md">🔒</span>
              <h3 className="relative z-10 mt-5 text-base font-black text-slate-900 group-hover:text-[#0B192C] transition">Segurança e Conta</h3>
              <p className="relative z-10 mt-2 text-xs leading-relaxed text-slate-500">Gerencie os dados da sua conta, credenciais de acesso e perfil profissional.</p>
              <div className="relative z-10 mt-5 flex items-center gap-1.5 text-xs font-bold text-[#0B192C] group-hover:translate-x-1 transition-transform">
                Gerir perfil →
              </div>
            </Link>
          </div>

          {/* Secção de Destaque Operacional */}
          <div className="rounded-[32px] border border-slate-200/80 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black tracking-tight text-slate-900">Visita em Destaque</h2>
              <span className="text-xs font-bold text-slate-400">Tempo Real</span>
            </div>
            
            {emAndamentoHoje ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 shadow-xs">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B192C] text-[#00D4FF] text-[10px] font-black uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF] animate-ping" /> Em Andamento
                  </span>
                  <h4 className="font-black text-lg text-slate-900">{getClient(emAndamentoHoje.clients).name || 'Cliente'}</h4>
                  <p className="text-xs font-semibold text-slate-600">📍 {getClient(emAndamentoHoje.clients).address || 'Morada não especificada'}</p>
                </div>
                <Link href="/trabalhador/agenda" className="h-12 inline-flex items-center justify-center rounded-2xl bg-[#0B192C] px-6 text-xs font-black text-white hover:bg-slate-800 transition shadow-md">
                  Gerir Tarefas / Concluir →
                </Link>
              </div>
            ) : proximaVisita ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 shadow-xs">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                    Próxima Visita às {formatTime(proximaVisita.scheduled_date)}
                  </span>
                  <h4 className="font-black text-lg text-slate-900">{getClient(proximaVisita.clients).name || 'Cliente'}</h4>
                  <p className="text-xs font-semibold text-slate-600">📍 {getClient(proximaVisita.clients).address || 'Morada não especificada'}</p>
                </div>
                <Link href="/trabalhador/agenda" className="h-12 inline-flex items-center justify-center rounded-2xl bg-[#0B192C] px-6 text-xs font-black text-white hover:bg-slate-800 transition shadow-md">
                  Ver na Agenda →
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-8 text-center">
                <span className="text-3xl mb-2 block">🎉</span>
                <p className="text-sm font-black text-slate-800">Sem mais visitas pendentes para hoje.</p>
                <p className="text-xs text-slate-500 mt-1">Bom descanso, o seu trabalho por hoje está concluído!</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}