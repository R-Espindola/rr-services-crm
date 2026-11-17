'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Calculator, CheckCircle2, CircleDollarSign, Clock3, Landmark, PiggyBank, Plus, Receipt, ShieldCheck, Sparkles, Trash2, Wallet, X } from 'lucide-react'
import { createFinanceExpense, createFinanceExtraIncome, deleteFinanceExpense, deleteFinanceExtraIncome, saveFinanceRules, updateFinanceExpenseRecurrence } from './actions'

export type FinanceRules = { tax_reserve_pct: number; business_ops_pct: number; personal_weekly_pct: number; savings_pct: number; weekly_fixed_target: number }
export type FinanceExpense = { id: string; title: string; amount: number; expense_type: 'personal' | 'business'; category: string; expense_date: string; is_recurring_weekly: boolean; is_recurring_monthly: boolean; recurrence_day: number | null; is_virtual_recurring: boolean; notes: string }
export type FinanceExtraIncome = { id: string; title: string; amount: number; category: 'freelance_web' | 'bonus_servico' | 'vendas' | 'reembolso' | 'outros'; income_date: string; notes: string }
export type FinanceOrderSummary = { id: string; status: string; total_amount: number; scheduled_date: string }
export type FinanceData = { weekStart: string; weekEnd: string; weekLabel: string; realized: number; forecast: number; cleaningGross: number; extraIncomeTotal: number; gross: number; expensesTotal: number; personalExpenses: number; businessExpenses: number; daysRemaining: number; rules: FinanceRules; expenses: FinanceExpense[]; extraIncomes: FinanceExtraIncome[]; upcomingExpenses: FinanceExpense[]; upcomingExtraIncomes: FinanceExtraIncome[]; orders: FinanceOrderSummary[] }

const currency = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const incomeLabels: Record<FinanceExtraIncome['category'], string> = { freelance_web: 'Freelance web', bonus_servico: 'Bónus de serviço', vendas: 'Vendas', reembolso: 'Reembolso', outros: 'Outros' }
const statusLabels: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmada', en_route: 'A caminho', in_progress: 'Em curso', completed: 'Concluída' }

function shiftWeek(value: string, amount: number) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + amount * 7); return date.toISOString().slice(0, 10) }

export default function FinanceDashboard({ data }: { data: FinanceData }) {
  const router = useRouter()
  const [tab, setTab] = useState<'expenses' | 'income'>('expenses')
  const [filter, setFilter] = useState<'all' | 'personal' | 'business'>('all')
  const [modal, setModal] = useState<'expense' | 'income' | 'rules' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [simulation, setSimulation] = useState('')
  const [expense, setExpense] = useState({ title: '', amount: '', expense_type: 'personal' as 'personal' | 'business', category: 'Geral', expense_date: data.weekStart, is_recurring_weekly: false, is_recurring_monthly: false, recurrence_day: '', notes: '' })
  const [income, setIncome] = useState({ title: '', amount: '', category: 'freelance_web' as FinanceExtraIncome['category'], income_date: data.weekStart, notes: '' })
  const [rules, setRules] = useState({ taxReservePct: String(data.rules.tax_reserve_pct), businessOpsPct: String(data.rules.business_ops_pct), personalWeeklyPct: String(data.rules.personal_weekly_pct), savingsPct: String(data.rules.savings_pct), weeklyFixedTarget: String(data.rules.weekly_fixed_target) })
  const reserve = data.gross * (data.rules.tax_reserve_pct + data.rules.business_ops_pct + data.rules.savings_pct) / 100
  const freeBalance = Math.max(0, data.gross - reserve - data.expensesTotal)
  const dailySafe = freeBalance / Math.max(data.daysRemaining, 1)
  const targetProgress = data.rules.weekly_fixed_target > 0 ? Math.min(100, data.gross / data.rules.weekly_fixed_target * 100) : 0
  const simulationValue = Number(simulation.replace(',', '.')) || 0
  const visibleExpenses = data.expenses.filter((item) => filter === 'all' || item.expense_type === filter)
  const buckets = [
    ['Reserva impostos', data.rules.tax_reserve_pct, data.gross * data.rules.tax_reserve_pct / 100, ShieldCheck, 'bg-rose-50 text-rose-700 border-rose-100'],
    ['Operação R&R', data.rules.business_ops_pct, data.gross * data.rules.business_ops_pct / 100, Landmark, 'bg-cyan-50 text-cyan-800 border-cyan-100'],
    ['Orçamento pessoal', data.rules.personal_weekly_pct, data.gross * data.rules.personal_weekly_pct / 100, Wallet, 'bg-violet-50 text-violet-700 border-violet-100'],
    ['Poupança', data.rules.savings_pct, data.gross * data.rules.savings_pct / 100, PiggyBank, 'bg-emerald-50 text-emerald-700 border-emerald-100'],
  ] as const
  const upcomingItems = [
    ...data.upcomingExpenses.map((item) => ({ ...item, date: item.expense_date, kind: 'expense' as const })),
    ...data.upcomingExtraIncomes.map((item) => ({ ...item, date: item.income_date, kind: 'income' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const result = await createFinanceExpense(expense); setFeedback(result.success ? 'Gasto guardado com sucesso.' : result.error); setSaving(false); if (result.success) { setModal(null); router.refresh() } }
  async function saveIncome(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const result = await createFinanceExtraIncome(income); setFeedback(result.success ? 'Renda extra guardada com sucesso.' : result.error); setSaving(false); if (result.success) { setModal(null); router.refresh() } }
  async function saveRules(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const result = await saveFinanceRules(rules); setFeedback(result.success ? 'Regras atualizadas.' : result.error); setSaving(false); if (result.success) { setModal(null); router.refresh() } }
  async function removeExpense(item: FinanceExpense) { if (!window.confirm('Eliminar este gasto?')) return; const result = await deleteFinanceExpense(item.id.split(':')[0]); setFeedback(result.success ? 'Gasto eliminado.' : result.error); if (result.success) router.refresh() }
  async function toggleRecurring(item: FinanceExpense) { const result = await updateFinanceExpenseRecurrence({ id: item.id.split(':')[0], is_recurring_monthly: false, recurrence_day: null }); setFeedback(result.success ? 'Recorrência mensal desativada.' : result.error); if (result.success) router.refresh() }
  async function removeIncome(id: string) { if (!window.confirm('Eliminar esta renda extra?')) return; const result = await deleteFinanceExtraIncome(id); setFeedback(result.success ? 'Renda extra eliminada.' : result.error); if (result.success) router.refresh() }

  return <main className="min-w-0 space-y-5 pb-12 sm:space-y-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Planeamento</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#061121] sm:text-3xl">Assistente Financeiro</h1><p className="mt-1 text-sm text-slate-500">Uma visão prática para tomar decisões semanais com confiança.</p></div><div className="flex items-center gap-2"><a href={`/admin/financas?week=${shiftWeek(data.weekStart, -1)}`} aria-label="Semana anterior" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"><ArrowLeft className="h-4 w-4" /></a><span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black tabular-nums text-slate-700">{data.weekLabel}</span><a href={`/admin/financas?week=${shiftWeek(data.weekStart, 1)}`} aria-label="Semana seguinte" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"><ArrowRight className="h-4 w-4" /></a></div></div>
    {feedback && <p role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-900">{feedback}</p>}
    <section className="relative isolate overflow-hidden rounded-2xl border border-slate-800 bg-[#061121] p-5 text-white shadow-sm sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-32 -z-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,212,255,0.16),transparent_65%)] blur-2xl" />
      <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
            <Sparkles className="h-3 w-3" /> Semana sob controlo
          </span>
          <p className="mt-3 text-xs font-semibold text-slate-400">Valor total da semana</p>
          <p className="mt-0.5 tabular-nums text-3xl font-extrabold tracking-tight text-cyan-400 sm:text-4xl">{currency(data.gross)}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            Limpezas: <span className="tabular-nums text-slate-200">{currency(data.cleaningGross)}</span>
            <span className="px-1.5 text-slate-600">•</span>
            Renda extra: <span className="tabular-nums text-emerald-300">{currency(data.extraIncomeTotal)}</span>
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 sm:px-4">
              <p className="text-[11px] font-medium leading-snug text-slate-400">Saldo disponível até domingo</p>
              <p className="mt-1 tabular-nums text-base font-extrabold text-white sm:text-lg">{currency(freeBalance)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 sm:px-4">
              <p className="text-[11px] font-medium leading-snug text-slate-400">Orçamento diário seguro</p>
              <p className="mt-1 tabular-nums text-base font-extrabold text-white sm:text-lg">{currency(dailySafe)}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 space-y-3 lg:col-span-5">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button type="button" onClick={() => setModal('income')} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-300/15">
              <Plus className="h-4 w-4" /> Renda extra
            </button>
            <button type="button" onClick={() => setModal('expense')} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[#00D4FF] px-3 text-xs font-black text-[#061121] transition-colors hover:bg-cyan-300">
              <Plus className="h-4 w-4" /> Registar gasto
            </button>
            <button type="button" onClick={() => setModal('rules')} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white transition-colors hover:bg-white/10">
              <Calculator className="h-4 w-4" /> Regras (%)
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 text-xs font-bold">
              <span className="text-slate-300">Receita vs. meta semanal</span>
              <span className="tabular-nums text-cyan-200">{Math.round(targetProgress)}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#00D4FF] transition-[width] duration-700 ease-out" style={{ width: `${targetProgress}%` }} />
            </div>
            <div className="mt-2.5 flex flex-wrap justify-between gap-1 text-[11px]">
              <span className="tabular-nums font-semibold text-slate-200">{currency(data.gross)} gerados</span>
              <span className="tabular-nums text-slate-400">Meta {currency(data.rules.weekly_fixed_target)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:col-span-8">
        {buckets.map(([label, pct, value, Icon, tone]) => <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 sm:p-4">
          <div className="flex min-h-8 items-start justify-between gap-2">
            <p className="text-[10px] font-black uppercase leading-snug tracking-wide text-slate-500">{label}</p>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${tone}`}><Icon className="h-4 w-4" /></span>
          </div>
          <p className="mt-3 truncate tabular-nums text-lg font-extrabold text-slate-900 sm:text-xl">{currency(value)}</p>
          <p className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-1 tabular-nums text-[10px] font-bold text-slate-600">{pct}% da receita</p>
        </article>)}
      </div>
      <aside className="flex flex-col justify-between rounded-2xl border border-slate-200/80 border-t-2 border-t-cyan-400 bg-white p-4 shadow-sm sm:p-5 xl:col-span-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><CircleDollarSign className="h-4 w-4" /></span>
            <h2 className="text-sm font-black text-[#061121]">Assistente de equilíbrio</h2>
          </div>
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
            <p className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{data.gross < data.rules.weekly_fixed_target ? <>Faltam <strong className="tabular-nums text-slate-900">{currency(data.rules.weekly_fixed_target - data.gross)}</strong> para atingir a meta.</> : <>A meta semanal está coberta.</>}</span>
            </p>
            <p className="flex items-start gap-2.5">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>Limite seguro hoje: <strong className="tabular-nums text-slate-900">{currency(dailySafe)}</strong>.</span>
            </p>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <label htmlFor="daily-spend-simulation" className="text-xs font-bold text-slate-600">Posso gastar quanto hoje?</label>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
              <input id="daily-spend-simulation" value={simulation} onChange={(event) => setSimulation(event.target.value)} inputMode="decimal" placeholder="80" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 text-sm tabular-nums text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/15" />
            </div>
            {simulationValue > 0 && <span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-bold ${freeBalance >= simulationValue ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {freeBalance >= simulationValue ? `+${currency(freeBalance - simulationValue)}` : `−${currency(simulationValue - freeBalance)}`}
            </span>}
          </div>
          {simulationValue > 0 && <p className={`mt-2 text-[11px] font-semibold ${freeBalance >= simulationValue ? 'text-emerald-700' : 'text-rose-700'}`}>
            {freeBalance >= simulationValue ? 'Fica disponível após este gasto.' : 'Este valor ultrapassa o saldo seguro.'}
          </p>}
        </div>
      </aside>
    </section>

    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 xl:col-span-8">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-cyan-600" />
              <h2 className="text-sm font-black text-[#061121]">Movimentos da semana</h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Entre {dateLabel(data.weekStart)} e {dateLabel(data.weekEnd)}.</p>
          </div>
          <div className="flex w-fit rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button type="button" onClick={() => setTab('expenses')} className={`rounded-lg px-3 py-2 transition-colors ${tab === 'expenses' ? 'bg-white text-[#061121] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Gastos</button>
            <button type="button" onClick={() => setTab('income')} className={`rounded-lg px-3 py-2 transition-colors ${tab === 'income' ? 'bg-white text-[#061121] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Rendas extra</button>
          </div>
        </div>
        {tab === 'expenses' ? <>
          <div className="flex gap-1 border-b border-slate-100 pt-3 text-[11px] font-bold">
            <button type="button" onClick={() => setFilter('all')} className={`rounded-lg px-2.5 py-1.5 transition-colors ${filter === 'all' ? 'bg-cyan-50 text-cyan-800' : 'text-slate-400 hover:text-slate-700'}`}>Todos</button>
            <button type="button" onClick={() => setFilter('personal')} className={`rounded-lg px-2.5 py-1.5 transition-colors ${filter === 'personal' ? 'bg-cyan-50 text-cyan-800' : 'text-slate-400 hover:text-slate-700'}`}>Pessoal</button>
            <button type="button" onClick={() => setFilter('business')} className={`rounded-lg px-2.5 py-1.5 transition-colors ${filter === 'business' ? 'bg-cyan-50 text-cyan-800' : 'text-slate-400 hover:text-slate-700'}`}>Empresa R&R</button>
          </div>
          {visibleExpenses.map((item) => <div key={item.id} className="flex flex-col gap-2 border-b border-slate-100 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500"><Receipt className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">{item.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                  <span>{item.category}</span><span>·</span><span>{dateLabel(item.expense_date)}</span>
                  {item.is_recurring_monthly && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800">Mensal · dia {item.recurrence_day}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pl-12 sm:pl-0">
              <span className="mr-auto tabular-nums text-xs font-extrabold text-slate-900 sm:mr-1">{currency(item.amount)}</span>
              {item.is_recurring_monthly && <button type="button" onClick={() => void toggleRecurring(item)} className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-800 transition-colors hover:bg-amber-100">Desativar</button>}
              <button type="button" onClick={() => void removeExpense(item)} aria-label={`Eliminar ${item.title}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>)}
          {visibleExpenses.length === 0 && <p className="py-8 text-center text-xs font-semibold text-slate-400">Ainda não existem gastos nesta semana.</p>}
        </> : <>
          {data.extraIncomes.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CircleDollarSign className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">{item.title}</p>
                <p className="mt-1 truncate text-[10px] text-slate-500">{incomeLabels[item.category]} · {dateLabel(item.income_date)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums text-xs font-extrabold text-emerald-700">+ {currency(item.amount)}</span>
              <button type="button" onClick={() => void removeIncome(item.id)} aria-label={`Eliminar ${item.title}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>)}
          {data.extraIncomes.length === 0 && <p className="py-8 text-center text-xs font-semibold text-slate-400">Ainda não existem rendas extra nesta semana.</p>}
        </>}
      </section>
      <aside className="flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 xl:col-span-4">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><Clock3 className="h-4 w-4" /></span>
            <h2 className="text-sm font-black text-[#061121]">Próximos lançamentos</h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Previsão dos próximos 35 dias.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {upcomingItems.map((item) => <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2.5 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-center text-[10px] font-black leading-tight tabular-nums text-slate-600">
              {new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' }).format(new Date(`${item.date}T12:00:00`))}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-slate-800">{item.title}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                {item.kind === 'expense' ? `Gasto · ${item.category}${item.is_recurring_monthly ? ` · Mensal (${item.recurrence_day})` : ''}` : `Renda extra · ${incomeLabels[item.category]}`}
              </p>
              {item.kind === 'expense' && item.is_recurring_monthly && <span className="mt-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Recorrente</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`tabular-nums text-[10px] font-extrabold ${item.kind === 'expense' ? 'text-rose-700' : 'text-emerald-700'}`}>{item.kind === 'expense' ? '−' : '+'}{currency(item.amount)}</span>
              <a href={`/admin/financas?week=${item.date}`} aria-label={`Ver semana de ${dateLabel(item.date)}`} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-700"><ArrowRight className="h-3.5 w-3.5" /></a>
            </div>
          </div>)}
          {upcomingItems.length === 0 && <p className="py-8 text-center text-xs font-semibold text-slate-400">Não existem lançamentos futuros registados.</p>}
        </div>
      </aside>
    </section>
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-cyan-600" />
        <h2 className="text-sm font-black text-[#061121]">Receita das limpezas</h2>
      </div>
      {data.orders.length > 0 ? data.orders.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-800">{statusLabels[item.status] ?? item.status}</p>
          <p className="text-[10px] tabular-nums text-slate-500">{new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.scheduled_date))}</p>
        </div>
        <span className="shrink-0 tabular-nums text-xs font-extrabold text-slate-900">{currency(item.total_amount)}</span>
      </div>) : <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">Ainda não há limpezas registadas nesta semana.</p>}
    </section>

    {modal === 'expense' && <Modal title="Registar gasto" close={() => setModal(null)}>
      <form onSubmit={saveExpense} className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Descrição
          <input name="title" required value={expense.title} onChange={(e) => setExpense({ ...expense, title: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Montante
            <input name="amount" required inputMode="decimal" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
          </label>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data
            <input name="expense_date" required type="date" value={expense.expense_date} onChange={(e) => setExpense({ ...expense, expense_date: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
          </label>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo
            <select name="expense_type" value={expense.expense_type} onChange={(e) => setExpense({ ...expense, expense_type: e.target.value as 'personal' | 'business' })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
              <option value="personal">Pessoal</option>
              <option value="business">Empresa R&R</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Categoria
            <input name="category" required value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input name="is_recurring_monthly" type="checkbox" checked={expense.is_recurring_monthly} onChange={(e) => setExpense({ ...expense, is_recurring_monthly: e.target.checked })} className="h-4 w-4 min-h-0 rounded border-slate-300 accent-cyan-600" />
          Repetir todos os meses neste dia
        </label>
        {expense.is_recurring_monthly && <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dia mensal
          <input name="recurrence_day" type="number" min="1" max="31" value={expense.recurrence_day} onChange={(e) => setExpense({ ...expense, recurrence_day: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" placeholder="Usa o dia da data se vazio" />
        </label>}
        <input name="is_recurring_weekly" type="hidden" value={String(expense.is_recurring_weekly)} />
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notas
          <textarea name="notes" value={expense.notes} onChange={(e) => setExpense({ ...expense, notes: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50/70 p-3 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
        </label>
        <SubmitButton saving={saving} label="Guardar gasto" />
      </form>
    </Modal>}
    {modal === 'income' && <Modal title="Registar renda extra" close={() => setModal(null)}>
      <form onSubmit={saveIncome} className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Descrição
          <input name="title" required value={income.title} onChange={(e) => setIncome({ ...income, title: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Montante
            <input name="amount" required inputMode="decimal" value={income.amount} onChange={(e) => setIncome({ ...income, amount: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
          </label>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data
            <input name="income_date" required type="date" value={income.income_date} onChange={(e) => setIncome({ ...income, income_date: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Categoria
          <select name="category" required value={income.category} onChange={(e) => setIncome({ ...income, category: e.target.value as FinanceExtraIncome['category'] })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
            <option value="freelance_web">Freelance web</option>
            <option value="bonus_servico">Bónus de serviço</option>
            <option value="vendas">Vendas</option>
            <option value="reembolso">Reembolso</option>
            <option value="outros">Outros</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notas
          <textarea name="notes" value={income.notes} onChange={(e) => setIncome({ ...income, notes: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50/70 p-3 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
        </label>
        <SubmitButton saving={saving} label="Guardar renda extra" />
      </form>
    </Modal>}
    {modal === 'rules' && <Modal title="Configurar regras (%)" close={() => setModal(null)}>
      <form onSubmit={saveRules} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {([['taxReservePct', 'Impostos'], ['businessOpsPct', 'Operação'], ['personalWeeklyPct', 'Pessoal'], ['savingsPct', 'Poupança']] as const).map(([key, label]) => <label key={key} className="block text-xs font-semibold text-slate-700 mb-1.5">{label}
            <input name={key} required type="number" min="0" max="100" step="0.01" value={rules[key]} onChange={(e) => setRules({ ...rules, [key]: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
          </label>)}
        </div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Meta semanal
          <input name="weeklyFixedTarget" required type="number" min="0" step="0.01" value={rules.weeklyFixedTarget} onChange={(e) => setRules({ ...rules, weeklyFixedTarget: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
        </label>
        <SubmitButton saving={saving} label="Guardar regras" />
      </form>
    </Modal>}
  </main>
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#061121]/60 p-4"><div className="my-6 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="mb-5 flex items-start justify-between"><h2 className="text-xl font-black text-[#061121]">{title}</h2><button type="button" onClick={close} aria-label="Fechar" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{children}</div></div> }
function SubmitButton({ saving, label }: { saving: boolean; label: string }) { return <div className="flex justify-end"><button disabled={saving} className="min-h-11 rounded-xl bg-[#061121] px-5 text-xs font-black text-white disabled:opacity-50">{saving ? 'A guardar...' : label}</button></div> }
