'use client'

import { useEffect, useMemo, useState } from 'react'
import { criarPlanoRecorrente, gerarProximasLimpezas, gerirPlanoRecorrente, listRecurringFormOptions, listRecurringSchedules, type RecurringFormOptions, type RecurringSchedule } from './actions'

const frequencyLabels: Record<string, string> = { weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal' }
const statusLabels: Record<string, string> = { active: 'Ativo', paused: 'Pausado', cancelled: 'Cancelado' }
type FormState = { clientId: string; propertyId: string; serviceTypeId: string; frequency: 'weekly' | 'biweekly' | 'monthly'; preferredWeekday: string; preferredStartTime: string; preferredEndTime: string; nextGenerationDate: string }
const initialForm: FormState = { clientId: '', propertyId: '', serviceTypeId: '', frequency: 'weekly', preferredWeekday: '1', preferredStartTime: '09:00', preferredEndTime: '09:30', nextGenerationDate: new Date().toISOString().slice(0, 10) }

export default function AdminRecorrenciasPage() {
  const [items, setItems] = useState<RecurringSchedule[]>([])
  const [options, setOptions] = useState<RecurringFormOptions>({ clients: [], properties: [], services: [] })
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function load() {
    setLoading(true)
    const [schedules, formOptions] = await Promise.all([listRecurringSchedules(), listRecurringFormOptions()])
    if (schedules.success) setItems(schedules.data)
    if (formOptions.success) setOptions(formOptions.data)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])
  const selectedClient = options.clients.find((client) => client.id === form.clientId)
  const clientProperties = useMemo(() => options.properties.filter((property) => property.client_id === form.clientId), [form.clientId, options.properties])
  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })) }
  async function generateNow() {
    setGenerating(true); setFeedback('')
    const result = await gerarProximasLimpezas()
    setFeedback(result.success ? `${result.data.count} próxima(s) limpeza(s) gerada(s).` : result.error)
    setGenerating(false); if (result.success) await load()
  }
  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback('')
    const result = await criarPlanoRecorrente({ ...form, propertyId: form.propertyId || null, preferredWeekday: Number(form.preferredWeekday) })
    if (result.success) { setModalOpen(false); setForm(initialForm); setFeedback('Plano recorrente criado com sucesso.'); await load() } else setFeedback(result.error)
    setSaving(false)
  }
  async function update(item: RecurringSchedule, status: 'active' | 'paused' | 'cancelled') {
    const pausedUntil = status === 'paused' ? window.prompt('Pausar até (AAAA-MM-DD):', item.paused_until ?? '') : null
    if (status === 'paused' && !pausedUntil) return
    const result = await gerirPlanoRecorrente({ id: item.id, status, pausedUntil })
    if (result.success) setItems((current) => current.map((row) => row.id === item.id ? { ...row, status, paused_until: pausedUntil } : row))
    else setFeedback(result.error)
  }

  return <main className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Operação</p><h1 className="mt-1 text-2xl font-black text-[#0B192C]">Planos recorrentes</h1></div><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setModalOpen(true)} className="min-h-11 rounded-xl border border-cyan-300 bg-cyan-50 px-4 text-xs font-black text-cyan-900 hover:bg-cyan-100">+ Novo Plano Recorrente</button><button type="button" onClick={() => void generateNow()} disabled={generating} className="min-h-11 rounded-xl bg-[#0B192C] px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">{generating ? 'A gerar...' : 'Gerar Próximas Limpezas Agora'}</button></div></header>
    {feedback && <p role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{feedback}</p>}
    <section className="space-y-3">{loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">A carregar planos...</div> : items.length === 0 ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Ainda não existem planos recorrentes.</div> : items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-[#0B192C]">{item.clientName}</h2><p className="text-sm text-slate-600">{item.propertyLabel} · {frequencyLabels[item.frequency] ?? item.frequency} · {item.preferred_start_time?.slice(0, 5) ?? 'Hora por definir'}</p><p className="mt-1 text-xs font-bold text-slate-500">Estado: {statusLabels[item.status]}{item.paused_until ? ` · retoma em ${item.paused_until}` : ''}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void update(item, item.status === 'active' ? 'paused' : 'active')} className="min-h-10 rounded-xl bg-[#0B192C] px-3 text-xs font-black text-white">{item.status === 'active' ? 'Pausar' : 'Reativar'}</button>{item.status !== 'cancelled' && <button type="button" onClick={() => void update(item, 'cancelled')} className="min-h-10 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700">Cancelar</button>}</div></div></article>)}</section>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B192C]/60 p-4"><form onSubmit={saveSchedule} className="my-6 w-full max-w-2xl space-y-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Novo plano</p><h2 className="mt-1 text-xl font-black text-[#0B192C]">Criar plano recorrente</h2></div><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl p-2 text-xl text-slate-400 hover:bg-slate-100" aria-label="Fechar">×</button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Cliente<select required value={form.clientId} onChange={(event) => { updateForm('clientId', event.target.value); updateForm('propertyId', '') }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Selecionar cliente</option>{options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Morada<select value={form.propertyId} onChange={(event) => updateForm('propertyId', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Usar/criar Morada Principal</option>{clientProperties.map((property) => <option key={property.id} value={property.id}>{property.label} · {property.city}</option>)}</select></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Tipo de serviço<select required value={form.serviceTypeId} onChange={(event) => updateForm('serviceTypeId', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Selecionar serviço</option>{options.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Frequência<select value={form.frequency} onChange={(event) => updateForm('frequency', event.target.value as FormState['frequency'])} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option></select></label><label className="text-xs font-bold text-slate-600">Dia preferido<select value={form.preferredWeekday} onChange={(event) => updateForm('preferredWeekday', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Chegada a partir das<input required type="time" value={form.preferredStartTime} onChange={(event) => updateForm('preferredStartTime', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label><label className="text-xs font-bold text-slate-600">Chegada até<input required type="time" value={form.preferredEndTime} onChange={(event) => updateForm('preferredEndTime', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Primeira geração<input required type="date" value={form.nextGenerationDate} onChange={(event) => updateForm('nextGenerationDate', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label></div>{!form.propertyId && selectedClient?.address && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Será criada automaticamente uma <strong>Morada Principal</strong> com: {selectedClient.address}, {selectedClient.postal_code || '0000-000'} {selectedClient.locality || ''}.</p>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModalOpen(false)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600">Cancelar</button><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-[#0B192C] px-5 text-xs font-black text-white disabled:opacity-60">{saving ? 'A guardar...' : 'Criar plano recorrente'}</button></div></form></div>}
  </main>
}
