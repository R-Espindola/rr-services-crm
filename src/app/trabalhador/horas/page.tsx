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

  return <div className="min-h-dvh overflow-x-hidden bg-[#F3F6FA] text-[#0B192C]">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#081426]/95 text-white shadow-xl backdrop-blur-xl"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8"><Link href="/trabalhador/agenda" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#0B192C]">R&amp;R</span><span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">Portal do trabalhador</span></span></Link><span className="hidden text-sm text-slate-300 sm:block">{workerName}</span></div></header>
    <main className="mx-auto max-w-[1500px] pb-24 lg:grid lg:grid-cols-[245px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200/80 bg-white/70 px-4 py-7 lg:block"><nav aria-label="Área de trabalho" className="space-y-1"><Link href="/trabalhador/agenda" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-100"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">▦</span>Agenda de hoje</Link><Link href="/trabalhador/horas" aria-current="page" className="flex min-h-12 items-center gap-3 rounded-xl bg-[#0B192C] px-3 text-[13px] font-semibold text-white"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00D4FF] text-[#0B192C]">◷</span>Horas trabalhadas</Link><Link href="/trabalhador/perfil" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-100"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">◎</span>Segurança</Link></nav></aside>
      <section className="min-w-0 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:py-9">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-[#0B192C] p-6 text-white shadow-xl sm:p-8 lg:p-10"><div className="absolute -right-12 -top-20 -z-10 h-64 w-64 rounded-full bg-[#00D4FF]/15 blur-3xl"/><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#70E8FF]">Resumo operacional</p><h1 className="mt-3 text-2xl font-black sm:text-3xl">Horas trabalhadas</h1><p className="mt-2 text-sm text-slate-300">Histórico de serviços concluídos{workerName ? ` · ${workerName}` : ''}</p></div><label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Mês de referência</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-12 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white outline-none focus:border-[#00D4FF] focus:ring-2 focus:ring-[#00D4FF]/30 [color-scheme:dark]" /></label></div>
          <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3"><Metric label="Total no mês" value={formatDuration(totals.minutes)} icon="◷"/><Metric label="Média por dia trabalhado" value={formatDuration(totals.average)} icon="▤"/><Metric label="Dias com serviço" value={String(totals.workDays)} icon="▦"/></div>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
        <div className="mt-8 flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-sky-700">Registos</p><h2 className="mt-1 text-xl font-black">Limpezas concluídas</h2></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">{rows.length} serviços</span></div>
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 p-3 md:hidden">{loading ? <p className="p-6 text-center text-sm text-slate-500">A carregar horas...</p> : rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Sem serviços concluídos neste mês.</p> : rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold">{row.service_type}</h3><p className="mt-1 text-xs capitalize text-slate-500">{dateLabel(row.completed_at ?? row.scheduled_date)}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800">{formatDuration(minutesFor(row))}</span></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs"><p className="text-slate-500">Início <strong className="ml-1 text-slate-800">{timeLabel(row.started_at)}</strong></p><p className="text-slate-500">Término <strong className="ml-1 text-slate-800">{timeLabel(row.completed_at)}</strong></p></div></article>)}</div>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Data</th><th className="px-5 py-4">Serviço</th><th className="px-5 py-4">Início</th><th className="px-5 py-4">Término</th><th className="px-5 py-4 text-right">Duração</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">A carregar horas...</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">Sem serviços concluídos neste mês.</td></tr> : rows.map((row) => <tr key={row.id} className="hover:bg-slate-50/70"><td className="px-5 py-4 capitalize text-slate-600">{dateLabel(row.completed_at ?? row.scheduled_date)}</td><td className="px-5 py-4 font-semibold text-[#0B192C]">{row.service_type}</td><td className="px-5 py-4 text-slate-600">{timeLabel(row.started_at)}</td><td className="px-5 py-4 text-slate-600">{timeLabel(row.completed_at)}</td><td className="px-5 py-4 text-right font-extrabold text-emerald-800">{formatDuration(minutesFor(row))}</td></tr>)}</tbody></table></div>
        </section>
      </section>
    </main>
    <nav aria-label="Navegação do trabalhador" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-lg lg:hidden"><Link href="/trabalhador/agenda" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500"><span>▦</span><span className="text-[10px] font-bold">Agenda</span></Link><Link href="/trabalhador/horas" aria-current="page" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sky-800"><span>◷</span><span className="text-[10px] font-extrabold">Horas</span></Link><Link href="/trabalhador/perfil" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500"><span>◎</span><span className="text-[10px] font-bold">Segurança</span></Link></nav>
  </div>
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white/[0.06] p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF]">{icon}</span><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-lg font-black text-white">{value}</p></div></div>
}
