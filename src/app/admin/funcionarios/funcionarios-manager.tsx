'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { createWorker, listWorkers, removeWorker, setWorkerActive, updateWorker, type WorkerRecord } from './actions'

type FormState = { name: string; email: string; phone: string; jobTitle: string; password: string; generatePassword: boolean }
const emptyForm: FormState = { name: '', email: '', phone: '', jobTitle: 'Trabalhador', password: '', generatePassword: true }
const dateLabel = (value: string) => new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
const formatHours = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`

export default function FuncionariosManager({ initialWorkers, initialError, initialMonth }: { initialWorkers: WorkerRecord[]; initialError: string; initialMonth: string }) {
  const [workers, setWorkers] = useState(initialWorkers)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkerRecord | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(initialError)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [month, setMonth] = useState(initialMonth)
  const [hoursLoading, setHoursLoading] = useState(false)
  const teamMinutes = workers.reduce((sum, worker) => sum + worker.total_month_minutes, 0)

  const filteredWorkers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-PT')
    if (!term) return workers
    return workers.filter((worker) => [worker.display_name, worker.email, worker.phone, worker.job_title]
      .some((value) => value?.toLocaleLowerCase('pt-PT').includes(term)))
  }, [workers, search])

  async function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(nextMonth)) return
    setHoursLoading(true)
    setError('')
    try {
      const result = await listWorkers(nextMonth)
      if (!result.success) { setError(result.error); return }
      setWorkers(result.data ?? [])
    } catch {
      setError('Não foi possível atualizar o resumo de horas.')
    } finally {
      setHoursLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setGeneratedPassword('')
    setError('')
    setNotice('')
    setModalOpen(true)
  }

  function openEdit(worker: WorkerRecord) {
    setEditing(worker)
    setForm({ name: worker.display_name, email: worker.email ?? '', phone: worker.phone ?? '', jobTitle: worker.job_title, password: '', generatePassword: false })
    setGeneratedPassword('')
    setError('')
    setNotice('')
    setModalOpen(true)
  }

  function closeModal() {
    if (busy) return
    setModalOpen(false)
    setEditing(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(editing ? `edit-${editing.user_id}` : 'create')
    try {
      if (editing) {
        const result = await updateWorker({ userId: editing.user_id, name: form.name, email: form.email, phone: form.phone, jobTitle: form.jobTitle })
        if (!result.success) { setError(result.error); return }
        setWorkers((current) => current.map((worker) => worker.user_id === editing.user_id ? { ...result.data!.worker, total_month_minutes: worker.total_month_minutes } : worker).sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt')))
        setNotice('Dados do funcionário atualizados.')
        setModalOpen(false)
      } else {
        const result = await createWorker(form)
        if (!result.success) { setError(result.error); return }
        setWorkers((current) => [...current, { ...result.data!.worker, total_month_minutes: 0 }].sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt')))
        setGeneratedPassword(result.temporaryPassword ?? '')
        setNotice('Funcionário criado e adicionado à equipa.')
        setModalOpen(false)
        setForm(emptyForm)
      }
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function toggleActive(worker: WorkerRecord) {
    const nextActive = !worker.active
    setBusy(`active-${worker.user_id}`)
    setError('')
    setNotice('')
    try {
      const result = await setWorkerActive(worker.user_id, nextActive)
      if (!result.success) { setError(result.error); return }
      setWorkers((current) => current.map((item) => item.user_id === worker.user_id ? { ...item, active: nextActive } : item))
      setNotice(nextActive ? `${worker.display_name} foi reativado.` : `${worker.display_name} foi desativado.`)
    } catch {
      setError('Não foi possível atualizar o estado do funcionário.')
    } finally {
      setBusy(null)
    }
  }

  async function deleteWorker(worker: WorkerRecord) {
    if (!window.confirm(`Remover ${worker.display_name}? A conta de autenticação será eliminada e as atribuições futuras ficarão sem funcionário.`)) return
    setBusy(`delete-${worker.user_id}`)
    setError('')
    setNotice('')
    try {
      const result = await removeWorker(worker.user_id)
      if (!result.success) { setError(result.error); return }
      setWorkers((current) => current.filter((item) => item.user_id !== worker.user_id))
      setNotice(`${worker.display_name} foi removido da equipa.`)
    } catch {
      setError('Não foi possível remover o funcionário.')
    } finally {
      setBusy(null)
    }
  }

  async function copyTemporaryPassword() {
    try {
      await navigator.clipboard.writeText(generatedPassword)
      setNotice('Palavra-passe temporária copiada. Partilhe-a por um canal seguro.')
    } catch {
      setError('Não foi possível copiar a palavra-passe neste dispositivo.')
    }
  }

  return (
    <main className="min-w-0 text-[#0B192C]">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">Equipa R&amp;R Services</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Gestão de Funcionários</h1>
          <p className="mt-2 text-sm text-slate-500">Gira acessos, contactos e estado dos profissionais da equipa.</p>
          <p className="mt-2 text-xs text-slate-400">{workers.length} {workers.length === 1 ? 'funcionário registado' : 'funcionários registados'}</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] focus-visible:ring-offset-2">
          <span aria-hidden="true" className="text-lg leading-none text-[#00D4FF]">＋</span> Cadastrar Novo Funcionário
        </button>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
      <section className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-xl text-sky-800">◷</span><div><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Total de horas da equipa · {month}</p><p className="mt-1 text-xl font-black">{hoursLoading ? 'A calcular…' : formatHours(teamMinutes)}</p></div></div>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className="text-xs font-bold text-slate-600">Mês de referência</span><input type="month" value={month} onChange={(event) => void changeMonth(event.target.value)} disabled={hoursLoading} className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-[#0B192C] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-60" /></label>
      </section>
      {generatedPassword && <section className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5"><div><h2 className="text-sm font-extrabold text-sky-950">Palavra-passe temporária — guarde agora</h2><p className="mt-1 text-xs leading-5 text-sky-800">Esta palavra-passe só é apresentada nesta sessão. Partilhe-a diretamente com o funcionário e recomende a alteração após o primeiro acesso.</p><code className="mt-3 block break-all rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-sm text-slate-800">{generatedPassword}</code></div><button type="button" onClick={() => void copyTemporaryPassword()} className="mt-3 min-h-11 w-full rounded-xl border border-sky-300 bg-white px-4 text-xs font-extrabold text-sky-900 hover:bg-sky-100 sm:mt-0 sm:w-auto">Copiar palavra-passe</button></section>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><h2 className="font-extrabold">Equipa</h2><p className="mt-1 text-xs text-slate-500">Dados e estado de acesso dos funcionários.</p></div>
          <label className="relative block w-full sm:max-w-xs"><span className="sr-only">Pesquisar funcionários</span><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar nome, e-mail, telefone..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100" /></label>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {filteredWorkers.length === 0 ? <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">{workers.length ? 'Nenhum funcionário corresponde à pesquisa.' : 'Ainda não existem funcionários registados.'}</div> : filteredWorkers.map((worker) => <article key={worker.user_id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 font-black text-sky-800">{worker.display_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div className="min-w-0"><h3 className="truncate text-sm font-extrabold">{worker.display_name}</h3><p className="truncate text-xs text-slate-500">{worker.job_title}</p></div></div><StatusBadge active={worker.active} /></div>
            <div className="mt-3 space-y-1 text-xs text-slate-600"><p className="break-all">{worker.email || 'Sem e-mail'}</p><p>{worker.phone || 'Sem telefone'} · Desde {dateLabel(worker.created_at)}</p><p className="font-extrabold text-sky-800">{hoursLoading ? 'A calcular horas…' : `${formatHours(worker.total_month_minutes)} neste mês`}</p></div>
            <div className="mt-4 grid grid-cols-3 gap-2"><button type="button" onClick={() => openEdit(worker)} className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 hover:border-sky-300 hover:bg-slate-50">Editar</button><button type="button" disabled={busy !== null} onClick={() => void toggleActive(worker)} className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busy === `active-${worker.user_id}` ? 'A guardar…' : worker.active ? 'Desativar' : 'Ativar'}</button><button type="button" disabled={busy !== null} onClick={() => void deleteWorker(worker)} className="min-h-11 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Remover</button></div>
          </article>)}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1020px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Funcionário</th><th className="px-5 py-3">Contacto</th><th className="px-5 py-3">Cargo</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Horas · {month}</th><th className="px-5 py-3">Data de criação</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredWorkers.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">{workers.length ? 'Nenhum funcionário corresponde à pesquisa.' : 'Ainda não existem funcionários registados.'}</td></tr> : filteredWorkers.map((worker) => <tr key={worker.user_id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-xs font-black text-sky-800">{worker.display_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><p className="font-extrabold text-[#0B192C]">{worker.display_name}</p><p className="mt-0.5 text-xs text-slate-500">{worker.email || 'Sem e-mail'}</p></div></div></td><td className="px-5 py-4 text-slate-600">{worker.phone || '—'}</td><td className="px-5 py-4 text-slate-600">{worker.job_title}</td><td className="px-5 py-4"><StatusBadge active={worker.active} /></td><td className="px-5 py-4 font-extrabold text-sky-800">{hoursLoading ? '…' : formatHours(worker.total_month_minutes)}</td><td className="px-5 py-4 text-xs text-slate-500">{dateLabel(worker.created_at)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(worker)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-sky-300 hover:bg-slate-50">Editar</button><button type="button" disabled={busy !== null} onClick={() => void toggleActive(worker)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{worker.active ? 'Desativar' : 'Ativar'}</button><button type="button" disabled={busy !== null} onClick={() => void deleteWorker(worker)} className="min-h-10 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Remover</button></div></td></tr>)}</tbody></table>
        </div>
      </section>

      {modalOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}>
        <section role="dialog" aria-modal="true" aria-labelledby="worker-modal-title" className="my-auto max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-700">Equipa R&amp;R</p><h2 id="worker-modal-title" className="mt-1 text-xl font-black">{editing ? 'Editar funcionário' : 'Cadastrar novo funcionário'}</h2><p className="mt-1 text-sm text-slate-500">{editing ? 'Atualize os dados profissionais e de contacto.' : 'Será criada uma conta de acesso ao portal do trabalhador.'}</p></div><button type="button" onClick={closeModal} disabled={busy !== null} aria-label="Fechar formulário" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button></div>
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div><label htmlFor="worker-name" className="mb-1.5 block text-xs font-bold text-slate-700">Nome completo</label><input id="worker-name" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="worker-email" className="mb-1.5 block text-xs font-bold text-slate-700">E-mail de acesso</label><input id="worker-email" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></div><div><label htmlFor="worker-phone" className="mb-1.5 block text-xs font-bold text-slate-700">Telefone</label><input id="worker-phone" type="tel" required minLength={7} maxLength={30} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></div></div>
            <div><label htmlFor="worker-title" className="mb-1.5 block text-xs font-bold text-slate-700">Cargo</label><input id="worker-title" required minLength={1} maxLength={80} value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} placeholder="Ex.: Trabalhador de limpeza" className="min-h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></div>
            {!editing && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" checked={form.generatePassword} onChange={(event) => setForm({ ...form, generatePassword: event.target.checked, password: '' })} className="h-5 w-5 rounded border-slate-300 accent-sky-700" /><span className="text-sm font-bold text-slate-800">Gerar palavra-passe temporária segura</span></label>{!form.generatePassword && <div className="mt-3"><label htmlFor="worker-password" className="mb-1.5 block text-xs font-bold text-slate-700">Palavra-passe temporária (mínimo 12 caracteres)</label><input id="worker-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></div>}</div>}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={busy !== null} onClick={closeModal} className="min-h-12 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button><button type="submit" disabled={busy !== null} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"><span aria-hidden="true">{busy ? '◌' : '✓'}</span>{busy ? 'A guardar...' : editing ? 'Guardar alterações' : 'Criar funcionário'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{active ? 'Ativo' : 'Inativo'}</span>
}
