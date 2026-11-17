'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type WorkRow = {
  id: string
  service_type: string
  scheduled_date: string
  started_at: string | null
  completed_at: string | null
  duration_minutes: number | null
  paused_duration_seconds: number | null
}

const localMonth = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const monthBounds = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(year, monthNumber - 1, 1)
  const end = new Date(year, monthNumber, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}
const minutesFor = (row: WorkRow) => row.duration_minutes ?? (row.started_at && row.completed_at
  ? Math.max(0, Math.floor((new Date(row.completed_at).getTime() - new Date(row.started_at).getTime() - (row.paused_duration_seconds ?? 0) * 1000) / 60_000))
  : 0)
const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
const timeLabel = (value: string | null) => value ? new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—'
const dateLabel = (value: string) => new Date(value).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

export default function WorkerHoursPage() {
  const [workerName, setWorkerName] = useState('')
  const [month, setMonth] = useState('')
  const [rows, setRows] = useState<WorkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadHours = useCallback(async (selectedMonth: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) return
    setLoading(true)
    setError('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('A sua sessão terminou. Inicie sessão novamente.')
      const { data: worker, error: workerError } = await supabase.from('worker_profiles')
        .select('display_name, active').eq('user_id', user.id).maybeSingle()
      if (workerError || !worker?.active) throw new Error('Perfil de trabalhador ativo não encontrado.')
      setWorkerName(worker.display_name)

      const bounds = monthBounds(selectedMonth)
      const { data, error: queryError } = await supabase.from('orders')
        .select('id, service_type, scheduled_date, started_at, completed_at, duration_minutes, paused_duration_seconds')
        .eq('worker_user_id', user.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .gte('completed_at', bounds.start)
        .lt('completed_at', bounds.end)
        .order('completed_at', { ascending: false })
      if (queryError) throw queryError
      setRows((data ?? []) as WorkRow[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o histórico de horas.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialize = window.setTimeout(() => setMonth(localMonth()), 0)
    return () => window.clearTimeout(initialize)
  }, [])

  useEffect(() => {
    if (!month) return
    const request = window.setTimeout(() => { void loadHours(month) }, 0)
    return () => window.clearTimeout(request)
  }, [loadHours, month])

  const totals = useMemo(() => {
    const minutes = rows.reduce((sum, row) => sum + minutesFor(row), 0)
    const workDays = new Set(rows.map((row) => new Date(row.completed_at ?? row.scheduled_date).toLocaleDateString('pt-PT'))).size
    return { minutes, average: workDays ? Math.round(minutes / workDays) : 0, workDays }
  }, [rows])

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
          </div>
        </div>
      </header>

      <div className="contents">
        {/* Sidebar Moderna */}
        <aside className="hidden">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Navegação</p>
          <nav aria-label="Área de trabalho" className="mt-4 space-y-2">
            <Link href="/trabalhador" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">🏠</span>Início (Dashboard)
            </Link>
            <Link href="/trabalhador/agenda" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">📅</span>Agenda de hoje
            </Link>
            <Link href="/trabalhador/turno" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">⏱️</span>Turno e pausas
            </Link>
            <Link href="/trabalhador/horas" aria-current="page" className="flex h-12 items-center gap-3.5 rounded-2xl bg-[#0B192C] px-4 text-xs font-bold text-white shadow-xl shadow-[#0B192C]/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00D4FF] text-[#0B192C] text-xs font-black">⏱️</span>Horas trabalhadas
              <span className="ml-auto h-2 w-2 rounded-full bg-[#00D4FF]" />
            </Link>
            <Link href="/trabalhador/perfil" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">🔒</span>Segurança / Perfil
            </Link>
          </nav>
          
          <div className="mt-12 rounded-3xl bg-gradient-to-br from-[#0B192C] to-[#173957] p-5 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-[#00D4FF]/10 blur-xl" />
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-sm text-[#0B192C] font-black">✦</span>
            <p className="mt-4 text-xs font-black tracking-wide">Controlo de ponto</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">Acompanhe o acumulado de horas e o histórico detalhado mensal.</p>
          </div>
          <p className="mt-10 px-3 text-[10px] font-semibold text-slate-400">© 2026 R&R Services</p>
        </aside>

        {/* Conteúdo Principal */}
        <main className="min-w-0 px-6 pb-28 pt-8 sm:px-10 lg:px-12 space-y-8">
          {/* Banner de Resumo Operacional */}
          <section className="relative isolate overflow-hidden rounded-[32px] bg-[#0B192C] p-8 text-white shadow-2xl sm:p-10">
            <div className="absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-[#00D4FF]/15 blur-3xl pointer-events-none" />
            
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#70E8FF]">
                  <span className="h-2 w-2 rounded-full bg-[#00D4FF] animate-pulse" /> Registo de Ponto
                </span>
                <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Horas Trabalhadas</h1>
                <p className="mt-2 text-sm text-slate-300">Histórico de serviços concluídos{workerName ? ` · ${workerName}` : ''}</p>
              </div>

              {/* Seletor de Mês Moderno */}
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">Mês de referência</span>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="h-12 rounded-2xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white outline-none focus:border-[#00D4FF] focus:ring-2 focus:ring-[#00D4FF]/30 [color-scheme:dark] shadow-inner"
                />
              </label>
            </div>

            {/* Cartões de Métricas */}
            <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
              <Metric label="Total no mês" value={formatDuration(totals.minutes)} icon="⏱️" />
              <Metric label="Média por dia trabalhado" value={formatDuration(totals.average)} icon="📊" />
              <Metric label="Dias com serviço" value={String(totals.workDays)} icon="📅" />
            </div>
          </section>

          {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-sm">{error}</p>}

          <div className="flex items-end justify-between gap-3 pt-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#00D4FF]">Registos</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Limpezas concluídas</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 shadow-xs">{rows.length} serviços</span>
          </div>

          {/* Listagem (Mobile Cards / Desktop Table) */}
          <section className="rounded-[32px] border border-slate-200/80 bg-white shadow-sm overflow-hidden p-2 sm:p-4">
            {/* Vista Mobile (Cartões) */}
            <div className="space-y-3 md:hidden p-2">
              {loading ? (
                <p className="p-8 text-center text-xs font-bold text-slate-400">A carregar horas...</p>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="text-3xl mb-2 block">📭</span>
                  <p className="text-xs font-extrabold text-slate-700">Sem serviços concluídos neste mês.</p>
                </div>
              ) : (
                rows.map((row) => (
                  <article key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-black text-slate-900">{row.service_type}</h3>
                        <p className="mt-1 text-[11px] font-semibold capitalize text-slate-500">{dateLabel(row.completed_at ?? row.scheduled_date)}</p>
                      </div>
                      <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-800">
                        {formatDuration(minutesFor(row))}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-3 text-xs">
                      <p className="text-slate-500">Início: <strong className="text-slate-800 font-bold">{timeLabel(row.started_at)}</strong></p>
                      <p className="text-slate-500">Término: <strong className="text-slate-800 font-bold">{timeLabel(row.completed_at)}</strong></p>
                    </div>
                  </article>
                ))
              )}
            </div>

            {/* Vista Desktop (Tabela Refinada) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Serviço</th>
                    <th className="px-6 py-4">Início</th>
                    <th className="px-6 py-4">Término</th>
                    <th className="px-6 py-4 text-right">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {loading ? (
                    <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-bold">A carregar horas...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-slate-500">Sem serviços concluídos neste mês.</td></tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-6 py-4 capitalize text-slate-500">{dateLabel(row.completed_at ?? row.scheduled_date)}</td>
                        <td className="px-6 py-4 font-black text-[#0B192C]">{row.service_type}</td>
                        <td className="px-6 py-4 text-slate-600 font-mono">{timeLabel(row.started_at)}</td>
                        <td className="px-6 py-4 text-slate-600 font-mono">{timeLabel(row.completed_at)}</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-700 font-mono text-sm">{formatDuration(minutesFor(row))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Barra de Navegação Móvel Inferior (Bottom Nav) */}
      <nav aria-label="Navegação do trabalhador" className="hidden">
        <Link href="/trabalhador/agenda" className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 transition hover:bg-slate-100 font-bold">
          <span className="text-base">📅</span>
          <span className="text-[10px]">Agenda</span>
        </Link>
        <Link href="/trabalhador/horas" aria-current="page" className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#0B192C] text-[#00D4FF] shadow-md">
          <span className="text-base">⏱️</span>
          <span className="text-[10px] font-black">Horas</span>
        </Link>
        <Link href="/trabalhador/perfil" className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 transition hover:bg-slate-100 font-bold">
          <span className="text-base">🔒</span>
          <span className="text-[10px]">Segurança</span>
        </Link>
      </nav>
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-4 bg-white/[0.05] backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-md">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF] text-lg font-black">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-lg font-black text-white">{value}</p>
      </div>
    </div>
  )
}
