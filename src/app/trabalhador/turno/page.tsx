'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type WorkerShift = {
  id: string
  started_at: string
  ended_at: string | null
  break_started_at: string | null
  break_duration_seconds: number
}

type ShiftAction = 'start' | 'pause' | 'resume' | 'finish'

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const formatTime = (value: string | null) => value
  ? new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  : '—'

function elapsedShiftSeconds(shift: WorkerShift, now: number) {
  const end = shift.ended_at ? new Date(shift.ended_at).getTime() : now
  const currentBreak = shift.break_started_at
    ? Math.max(0, Math.floor((now - new Date(shift.break_started_at).getTime()) / 1000))
    : 0
  return Math.max(0, Math.floor((end - new Date(shift.started_at).getTime()) / 1000)
    - shift.break_duration_seconds - currentBreak)
}

export default function WorkerShiftPage() {
  const [workerName, setWorkerName] = useState('')
  const [activeShift, setActiveShift] = useState<WorkerShift | null>(null)
  const [history, setHistory] = useState<WorkerShift[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<ShiftAction | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(0)

  const loadShifts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('A sua sessão terminou. Inicie sessão novamente.')

      const { data: worker, error: workerError } = await supabase.from('worker_profiles')
        .select('display_name, active').eq('user_id', user.id).maybeSingle()
      if (workerError) throw workerError
      if (!worker?.active) throw new Error('Não existe um perfil de trabalhador ativo associado a esta conta.')
      setWorkerName(worker.display_name)

      const since = new Date()
      since.setDate(since.getDate() - 30)
      const [activeResult, historyResult] = await Promise.all([
        supabase.from('worker_shifts')
          .select('id, started_at, ended_at, break_started_at, break_duration_seconds')
          .eq('worker_user_id', user.id)
          .is('ended_at', null)
          .maybeSingle(),
        supabase.from('worker_shifts')
          .select('id, started_at, ended_at, break_started_at, break_duration_seconds')
          .eq('worker_user_id', user.id)
          .not('ended_at', 'is', null)
          .gte('started_at', since.toISOString())
          .order('started_at', { ascending: false })
          .limit(30),
      ])
      if (activeResult.error) throw activeResult.error
      if (historyResult.error) throw historyResult.error

      setActiveShift(activeResult.data as WorkerShift | null)
      setHistory((historyResult.data ?? []) as WorkerShift[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o registo de turnos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => { void loadShifts() }, 0)
    return () => window.clearTimeout(request)
  }, [loadShifts])

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(initialUpdate)
      window.clearInterval(timer)
    }
  }, [])

  const completedSummary = useMemo(() => {
    const workedSeconds = history.reduce((sum, shift) => sum + elapsedShiftSeconds(shift, now), 0)
    return { workedSeconds, shifts: history.length }
  }, [history, now])

  async function performAction(action: ShiftAction) {
    if (action === 'finish' && !window.confirm('Tem a certeza de que pretende terminar o turno?')) return
    setBusy(action)
    setError('')
    setNotice('')
    try {
      const rpcName = {
        start: 'worker_start_shift',
        pause: 'worker_pause_shift',
        resume: 'worker_resume_shift',
        finish: 'worker_finish_shift',
      }[action]
      const { error: rpcError } = await supabase.rpc(rpcName)
      if (rpcError) throw rpcError
      setNotice({
        start: 'Turno iniciado.',
        pause: 'Pausa iniciada.',
        resume: 'Pausa terminada.',
        finish: 'Turno terminado e guardado.',
      }[action])
      await loadShifts()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registar esta ação.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#F3F6FA] text-sm font-bold text-slate-500">A carregar o registo de turnos...</main>
  }

  const onBreak = Boolean(activeShift?.break_started_at)
  const activeSeconds = activeShift ? elapsedShiftSeconds(activeShift, now) : 0

  return (
    <main className="min-h-dvh bg-[#F3F6FA] px-4 py-6 text-[#0B192C] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/trabalhador" className="text-xs font-bold text-slate-500 transition hover:text-[#0B192C]">← Portal do trabalhador</Link>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Turno e pausas</h1>
            <p className="mt-1 text-sm text-slate-500">{workerName ? `Registo de ${workerName}` : 'Registo do seu tempo de trabalho'}</p>
          </div>
          <nav aria-label="Navegação do trabalhador" className="flex flex-wrap gap-2">
            <Link href="/trabalhador/agenda" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Agenda</Link>
            <Link href="/trabalhador/horas" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Horas por limpeza</Link>
          </nav>
        </header>

        {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${activeShift ? onBreak ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {activeShift ? onBreak ? 'Em pausa' : 'Turno ativo' : 'Sem turno ativo'}
              </span>
              <p className="mt-4 font-mono text-4xl font-black tracking-tight text-[#0B192C] sm:text-5xl" aria-live="polite">
                {activeShift ? formatDuration(activeSeconds) : '00h 00m 00s'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {activeShift
                  ? `Início às ${formatTime(activeShift.started_at)} · pausas excluídas do total`
                  : 'Inicie o turno quando começar o seu período de trabalho.'}
              </p>
            </div>
            <div className="grid w-full gap-2 sm:w-auto sm:min-w-48">
              {!activeShift ? (
                <button type="button" disabled={busy !== null} onClick={() => void performAction('start')} className="min-h-12 rounded-xl bg-[#0B192C] px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {busy === 'start' ? 'A iniciar...' : 'Iniciar turno'}
                </button>
              ) : (
                <>
                  {onBreak ? (
                    <button type="button" disabled={busy !== null} onClick={() => void performAction('resume')} className="min-h-12 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">
                      {busy === 'resume' ? 'A retomar...' : 'Terminar pausa'}
                    </button>
                  ) : (
                    <button type="button" disabled={busy !== null} onClick={() => void performAction('pause')} className="min-h-12 rounded-xl border border-violet-200 bg-violet-50 px-5 text-sm font-bold text-violet-800 transition hover:bg-violet-100 disabled:opacity-50">
                      {busy === 'pause' ? 'A iniciar pausa...' : 'Iniciar pausa'}
                    </button>
                  )}
                  <button type="button" disabled={busy !== null} onClick={() => void performAction('finish')} className="min-h-12 rounded-xl border border-rose-200 bg-white px-5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
                    {busy === 'finish' ? 'A terminar...' : 'Terminar turno'}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            Este registo é separado do cronómetro de cada limpeza. O total do turno desconta as pausas registadas.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700">Últimos 30 dias</p>
              <h2 className="mt-1 text-lg font-black">Histórico de turnos</h2>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {completedSummary.shifts} turnos · {formatDuration(completedSummary.workedSeconds)}
            </p>
          </div>
          {history.length ? (
            <ul className="mt-5 divide-y divide-slate-100">
              {history.map((shift) => (
                <li key={shift.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-bold capitalize text-slate-800">{formatDate(shift.started_at)}</span>
                  <span className="text-xs text-slate-500">
                    {formatTime(shift.started_at)}–{formatTime(shift.ended_at)}
                    {' · '}pausa {formatDuration(shift.break_duration_seconds)}
                    {' · '}<strong className="text-slate-700">{formatDuration(elapsedShiftSeconds(shift, now))}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">Ainda não existem turnos concluídos neste período.</p>
          )}
        </section>
      </div>
    </main>
  )
}
