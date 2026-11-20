'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Calculator, CheckCircle2, CircleDollarSign, Clock3, Fuel, Home, Landmark, Laptop, Package, PiggyBank, Plus, Receipt, ShieldCheck, ShoppingCart, Sparkles, Trash2, Wallet, X } from 'lucide-react'
import { addFinanceDays, financeDateForInstant, financeDayDifference, financeDaysInMonth, formatFinanceDate, formatFinanceDateTime } from '@/lib/finance/dates'
import { fromCents, percentageCents, sumCents, toCents } from '@/lib/finance/money'
import { convertRevolutTransactionToExtraIncome, createFinanceExpense, createFinanceExtraIncome, deleteFinanceExpense, deleteFinanceExtraIncome, markFinanceOrderPaid, reconcileRevolutTransactionWithOrder, saveFinanceRules, updateFinanceExpenseRecurrence } from './actions'

export type FinanceRules = { tax_reserve_pct: number; business_ops_pct: number; personal_weekly_pct: number; savings_pct: number; weekly_fixed_target: number }
export type FinanceExpense = { id: string; title: string; amount: number; expense_type: 'personal' | 'business'; category: string; expense_date: string; is_recurring_weekly: boolean; is_recurring_monthly: boolean; recurrence_day: number | null; is_virtual_recurring: boolean; notes: string }
export type FinanceExtraIncome = { id: string; title: string; amount: number; category: 'freelance_web' | 'bonus_servico' | 'vendas' | 'reembolso' | 'outros'; income_date: string; notes: string }
export type FinanceOrderSummary = { id: string; status: string; total_amount: number; scheduled_date: string; payment_status?: string | null }
export type FinanceRevolutTransaction = { bank_tx_id: string; title: string; amount: number; direction: 'expense' | 'income'; merchant_name: string | null; counterparty_name: string | null; transaction_at: string; category: string; matched_order_id: string | null; converted_extra_income_id: string | null }
export type FinanceUnpaidOrder = { id: string; service_type: string; total_amount: number; scheduled_date: string; payment_status: string | null; client_name: string }
export type FinanceData = { weekStart: string; weekEnd: string; weekLabel: string; today: string; monthStart: string; realized: number; forecast: number; cleaningGross: number; extraIncomeTotal: number; gross: number; expensesTotal: number; personalExpenses: number; businessExpenses: number; daysRemaining: number; rules: FinanceRules; warnings: string[]; paymentStatusAvailable: boolean; unpaidOrdersAvailable: boolean; revolutAvailable: boolean; expenses: FinanceExpense[]; previousWeekExpenses: FinanceExpense[]; monthExpenses: FinanceExpense[]; previousMonthExpenses: FinanceExpense[]; extraIncomes: FinanceExtraIncome[]; monthExtraIncomes: FinanceExtraIncome[]; upcomingExpenses: FinanceExpense[]; upcomingExtraIncomes: FinanceExtraIncome[]; orders: FinanceOrderSummary[]; monthOrders: FinanceOrderSummary[]; revolutTransactions: FinanceRevolutTransaction[]; unpaidOrders: FinanceUnpaidOrder[] }

const currency = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(fromCents(toCents(value)))
const percentLabel = (value: number) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const dateLabel = (value: string) => formatFinanceDate(value, { day: '2-digit', month: '2-digit', year: 'numeric' })
const incomeLabels: Record<FinanceExtraIncome['category'], string> = { freelance_web: 'Freelance web', bonus_servico: 'Bónus de serviço', vendas: 'Vendas', reembolso: 'Reembolso', outros: 'Outros' }
const statusLabels: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmada', en_route: 'A caminho', in_progress: 'Em curso', completed: 'Concluída' }
type ExpenseCategory = 'combustivel' | 'supermercado' | 'produtos' | 'tecnologia' | 'habitacao' | 'outros'

const expenseCategories: { key: ExpenseCategory; label: string; color: string; Icon: typeof Fuel }[] = [
  { key: 'combustivel', label: 'Combustível', color: '#f59e0b', Icon: Fuel },
  { key: 'supermercado', label: 'Supermercado', color: '#10b981', Icon: ShoppingCart },
  { key: 'produtos', label: 'Produtos & Materiais', color: '#00D4FF', Icon: Package },
  { key: 'tecnologia', label: 'Software & Tecnologia', color: '#6366f1', Icon: Laptop },
  { key: 'habitacao', label: 'Habitação & Fixos', color: '#475569', Icon: Home },
  { key: 'outros', label: 'Outros', color: '#94a3b8', Icon: Receipt },
]

const expenseCategoryLabels = Object.fromEntries(expenseCategories.map(({ key, label }) => [key, label])) as Record<ExpenseCategory, string>
const categoryGroups: { key: string; label: string; categories: ExpenseCategory[]; Icon: typeof Fuel; color: string; tint: string; countLabel: string }[] = [
  { key: 'combustivel', label: 'Combustível (Gasolina)', categories: ['combustivel'], Icon: Fuel, color: 'text-amber-700', tint: 'bg-amber-50' , countLabel: 'abastecimento' },
  { key: 'supermercado', label: 'Supermercado (Mercado)', categories: ['supermercado'], Icon: ShoppingCart, color: 'text-emerald-700', tint: 'bg-emerald-50', countLabel: 'compra' },
  { key: 'operacao', label: 'Produtos & Operação R&R', categories: ['produtos', 'tecnologia'], Icon: Package, color: 'text-cyan-800', tint: 'bg-cyan-50', countLabel: 'movimento' },
  { key: 'fixos', label: 'Habitação / Fixos / Outros', categories: ['habitacao', 'outros'], Icon: Home, color: 'text-slate-700', tint: 'bg-slate-100', countLabel: 'movimento' },
]

export function normalizeExpenseCategory(value: string): ExpenseCategory {
  const normalized = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
  if (/\b(combustivel|gasolina|fuel|petrol)\b/.test(normalized)) return 'combustivel'
  if (/\b(supermercado|mercado|mercearia|grocery)\b/.test(normalized)) return 'supermercado'
  if (/\b(tecnologia|software|informatica|technology)\b/.test(normalized)) return 'tecnologia'
  if (/\b(habitacao|fixos|renda|utilities|casa)\b/.test(normalized)) return 'habitacao'
  if (/\b(produtos|materiais|limpeza|supplies|products)\b/.test(normalized)) return 'produtos'
  return 'outros'
}

function sumExpenses(expenses: FinanceExpense[], categories?: ExpenseCategory[]) {
  return fromCents(sumCents(expenses.filter((item) => !categories || categories.includes(normalizeExpenseCategory(item.category))).map((item) => item.amount)))
}

function periodChange(current: number, previous: number) {
  const currentCents = toCents(current)
  const previousCents = toCents(previous)
  if (previousCents === 0) return currentCents === 0 ? '0%' : 'Novo'
  const change = ((currentCents - previousCents) / previousCents) * 100
  return `${change > 0 ? '+' : ''}${Math.round(change)}%`
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <h3 className="text-sm font-black text-[#061121]">{title}</h3>
    {children}
  </section>
}

function shiftWeek(value: string, amount: number) { return addFinanceDays(value, amount * 7) }

type FinanceCsvRow = { data: string; descricao: string; tipo: string; categoria: string; valor_eur: string }

function downloadFinanceCsv(filename: string, rows: FinanceCsvRow[]) {
  const headers: (keyof FinanceCsvRow)[] = ['data', 'descricao', 'tipo', 'categoria', 'valor_eur']
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const content = [headers.join(';'), ...rows.map((row) => headers.map((header) => escape(row[header])).join(';'))].join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function FinanceDashboard({ data }: { data: FinanceData }) {
  const router = useRouter()
  const [tab, setTab] = useState<'expenses' | 'income'>('expenses')
  const [filter, setFilter] = useState<'all' | 'personal' | 'business'>('all')
  const [analysisPeriod, setAnalysisPeriod] = useState<'week' | 'month'>('week')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [highlightedSlice, setHighlightedSlice] = useState<ExpenseCategory | null>(null)
  const [flowTooltip, setFlowTooltip] = useState<{ id: string; label: string; series: string; value: number } | null>(null)
  const [modal, setModal] = useState<'expense' | 'income' | 'rules' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success')
  const [saving, setSaving] = useState(false)
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const [simulation, setSimulation] = useState('')
  const [revolutOrderSelections, setRevolutOrderSelections] = useState<Record<string, string>>({})
  const [revolutCategorySelections, setRevolutCategorySelections] = useState<Record<string, FinanceExtraIncome['category']>>({})
  const [revolutActionKey, setRevolutActionKey] = useState('')
  const [expense, setExpense] = useState({ title: '', amount: '', expense_type: 'personal' as 'personal' | 'business', category: 'outros', expense_date: data.weekStart, is_recurring_weekly: false, is_recurring_monthly: false, recurrence_day: '', notes: '' })
  const [income, setIncome] = useState({ title: '', amount: '', category: 'freelance_web' as FinanceExtraIncome['category'], income_date: data.weekStart, notes: '' })
  const [rules, setRules] = useState({ taxReservePct: String(data.rules.tax_reserve_pct), businessOpsPct: String(data.rules.business_ops_pct), personalWeeklyPct: String(data.rules.personal_weekly_pct), savingsPct: String(data.rules.savings_pct), weeklyFixedTarget: String(data.rules.weekly_fixed_target) })
  const grossCents = toCents(data.gross)
  const taxReserveCents = percentageCents(grossCents, data.rules.tax_reserve_pct)
  const businessOpsCents = percentageCents(grossCents, data.rules.business_ops_pct)
  const savingsCents = percentageCents(grossCents, data.rules.savings_pct)
  const expensesCents = toCents(data.expensesTotal)
  const freeBalanceCents = grossCents - taxReserveCents - businessOpsCents - savingsCents - expensesCents
  const freeBalance = fromCents(freeBalanceCents)
  const dailySafe = fromCents(Math.round(freeBalanceCents / Math.max(data.daysRemaining, 1)))
  const targetCents = toCents(data.rules.weekly_fixed_target)
  const targetProgress = targetCents > 0 ? Math.min(100, grossCents / targetCents * 100) : 0
  const simulationValueCents = toCents(simulation)
  const simulatedBalanceCents = freeBalanceCents - simulationValueCents
  const analysisExpenses = analysisPeriod === 'week' ? data.expenses : data.monthExpenses
  const previousAnalysisExpenses = analysisPeriod === 'week' ? data.previousWeekExpenses : data.previousMonthExpenses
  const analysisIncomes = analysisPeriod === 'week' ? data.extraIncomes : data.monthExtraIncomes
  const analysisOrders = analysisPeriod === 'week' ? data.orders : data.monthOrders
  const analysisStart = analysisPeriod === 'week' ? data.weekStart : data.monthStart
  const categoryTotals = expenseCategories.map((category) => ({
    ...category,
    amount: sumExpenses(analysisExpenses, [category.key]),
  }))
  const analysisTotal = sumExpenses(analysisExpenses)
  const categoryGroupsWithTotals = categoryGroups.map((group) => {
    const amount = sumExpenses(analysisExpenses, group.categories)
    const previousAmount = sumExpenses(previousAnalysisExpenses, group.categories)
    const count = analysisExpenses.filter((item) => group.categories.includes(normalizeExpenseCategory(item.category))).length
    const share = analysisTotal > 0 ? toCents(amount) / toCents(analysisTotal) * 100 : 0
    return { ...group, amount, previousAmount, count, share, change: periodChange(amount, previousAmount) }
  })
  const visibleExpenses = data.expenses.filter((item) =>
    (filter === 'all' || item.expense_type === filter) &&
    (!categoryFilter || categoryGroups.find((group) => group.key === categoryFilter)?.categories.includes(normalizeExpenseCategory(item.category))),
  )
  const monthDayCount = financeDaysInMonth(data.monthStart)
  const flowItems = analysisPeriod === 'week'
    ? Array.from({ length: 7 }, (_, index) => {
      const date = addFinanceDays(analysisStart, index)
      const dayIncomes = fromCents(sumCents(analysisOrders.filter((item) => item.status === 'completed' && financeDateForInstant(item.scheduled_date) === date).map((item) => item.total_amount)))
      const dayExtra = fromCents(sumCents(analysisIncomes.filter((item) => item.income_date === date).map((item) => item.amount)))
      const expenses = analysisExpenses.filter((item) => item.expense_date === date)
      return {
        label: formatFinanceDate(date, { weekday: 'short' }).replace('.', ''),
        cleaning: dayIncomes,
        extra: dayExtra,
        personal: fromCents(sumCents(expenses.filter((item) => item.expense_type === 'personal').map((item) => item.amount))),
        business: fromCents(sumCents(expenses.filter((item) => item.expense_type === 'business').map((item) => item.amount))),
      }
    })
    : Array.from({ length: Math.ceil(monthDayCount / 7) }, (_, index) => {
        const startDay = index * 7 + 1
        const start = `${data.monthStart.slice(0, 7)}-${String(startDay).padStart(2, '0')}`
        const end = addFinanceDays(start, 7)
        const inRange = (date: string) => date >= start && date < end
        const cleaning = fromCents(sumCents(analysisOrders.filter((item) => item.status === 'completed' && inRange(financeDateForInstant(item.scheduled_date))).map((item) => item.total_amount)))
        const extra = fromCents(sumCents(analysisIncomes.filter((item) => inRange(item.income_date)).map((item) => item.amount)))
        const expenses = analysisExpenses.filter((item) => inRange(item.expense_date))
        const lastDay = Math.min(startDay + 6, monthDayCount)
        return {
          label: `${startDay}–${lastDay}`,
          cleaning,
          extra,
          personal: fromCents(sumCents(expenses.filter((item) => item.expense_type === 'personal').map((item) => item.amount))),
          business: fromCents(sumCents(expenses.filter((item) => item.expense_type === 'business').map((item) => item.amount))),
        }
      })
  const flowMax = Math.max(1, ...flowItems.flatMap((item) => [item.cleaning, item.extra, item.personal, item.business]))
  const donutSegments = categoryTotals.filter((item) => item.amount > 0).reduce<Array<(typeof categoryTotals)[number] & { percent: number; offset: number }>>((segments, item) => {
    const percent = item.amount / analysisTotal * 100
    const previousSegment = segments[segments.length - 1]
    return [...segments, { ...item, percent, offset: previousSegment ? previousSegment.offset + previousSegment.percent : 0 }]
  }, [])
  const buckets = [
    ['Reserva impostos', data.rules.tax_reserve_pct, fromCents(percentageCents(grossCents, data.rules.tax_reserve_pct)), ShieldCheck, 'bg-rose-50 text-rose-700 border-rose-100'],
    ['Operação R&R', data.rules.business_ops_pct, fromCents(percentageCents(grossCents, data.rules.business_ops_pct)), Landmark, 'bg-cyan-50 text-cyan-800 border-cyan-100'],
    ['Orçamento pessoal', data.rules.personal_weekly_pct, fromCents(percentageCents(grossCents, data.rules.personal_weekly_pct)), Wallet, 'bg-violet-50 text-violet-700 border-violet-100'],
    ['Poupança', data.rules.savings_pct, fromCents(percentageCents(grossCents, data.rules.savings_pct)), PiggyBank, 'bg-emerald-50 text-emerald-700 border-emerald-100'],
  ] as const
  const upcomingItems = [
    ...data.upcomingExpenses.map((item) => ({ ...item, date: item.expense_date, kind: 'expense' as const })),
    ...data.upcomingExtraIncomes.map((item) => ({ ...item, date: item.income_date, kind: 'income' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const pendingRevolutTransactions = data.revolutTransactions.filter((item) => item.direction === 'income' && !item.matched_order_id && !item.converted_extra_income_id)
  const processedRevolutTransactions = data.revolutTransactions.filter((item) => item.direction === 'expense' || item.matched_order_id || item.converted_extra_income_id)

  function exportPeriodCsv(period: 'week' | 'month') {
    const expenses = period === 'week' ? data.expenses : data.monthExpenses
    const incomes = period === 'week' ? data.extraIncomes : data.monthExtraIncomes
    const orders = period === 'week' ? data.orders : data.monthOrders
    const rows: FinanceCsvRow[] = [
      ...expenses.map((item) => ({
        data: item.expense_date,
        descricao: item.title,
        tipo: item.expense_type === 'business' ? 'Saída · Empresa R&R' : 'Saída · Pessoal',
        categoria: expenseCategoryLabels[normalizeExpenseCategory(item.category)],
        valor_eur: `-${currency(item.amount)}`,
      })),
      ...incomes.map((item) => ({
        data: item.income_date,
        descricao: item.title,
        tipo: 'Entrada · Renda extra',
        categoria: incomeLabels[item.category],
        valor_eur: currency(item.amount),
      })),
      ...orders.map((item) => ({
        data: financeDateForInstant(item.scheduled_date),
        descricao: `Limpeza ${statusLabels[item.status] ?? item.status}`,
        tipo: item.status === 'completed' ? 'Entrada · Limpeza realizada' : 'Entrada prevista · Limpeza',
        categoria: 'Serviços',
        valor_eur: currency(item.total_amount),
      })),
    ].sort((a, b) => a.data.localeCompare(b.data))
    downloadFinanceCsv(`financas-${period === 'week' ? data.weekStart : data.monthStart}.csv`, rows)
  }

  async function runAction<T>(
    action: () => Promise<{ success: true; data: T } | { success: false; error: string }>,
    successMessage: string,
    fallbackError: string,
  ) {
    setSaving(true)
    try {
      const result = await action()
      setFeedback(result.success ? successMessage : result.error)
      setFeedbackTone(result.success ? 'success' : 'error')
      if (result.success) router.refresh()
      return result.success
    } catch (error) {
      console.error('[Finanças] Não foi possível concluir a ação.', error)
      setFeedback(fallbackError)
      setFeedbackTone('error')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await runAction(() => createFinanceExpense(expense), 'Gasto guardado com sucesso.', 'Não foi possível guardar o gasto.')) setModal(null)
  }
  async function saveIncome(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await runAction(() => createFinanceExtraIncome(income), 'Renda extra guardada com sucesso.', 'Não foi possível guardar a renda extra.')) setModal(null)
  }
  async function saveRules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await runAction(() => saveFinanceRules(rules), 'Regras atualizadas.', 'Não foi possível atualizar as regras.')) setModal(null)
  }
  async function removeExpense(item: FinanceExpense) {
    if (!window.confirm('Eliminar este gasto?')) return
    await runAction(() => deleteFinanceExpense(item.id.split(':')[0]), 'Gasto eliminado.', 'Não foi possível eliminar o gasto.')
  }
  async function toggleRecurring(item: FinanceExpense) {
    await runAction(
      () => updateFinanceExpenseRecurrence({ id: item.id.split(':')[0], is_recurring_weekly: false, is_recurring_monthly: false, recurrence_day: null }),
      'Recorrência desativada.',
      'Não foi possível desativar a recorrência.',
    )
  }
  async function removeIncome(id: string) {
    if (!window.confirm('Eliminar esta renda extra?')) return
    await runAction(() => deleteFinanceExtraIncome(id), 'Renda extra eliminada.', 'Não foi possível eliminar a renda extra.')
  }
  async function reconcileRevolutTransaction(logId: string) {
    const orderId = revolutOrderSelections[logId]
    if (!orderId) {
      setFeedback('Selecione a limpeza que corresponde à transferência.')
      setFeedbackTone('error')
      return
    }
    setRevolutActionKey(logId)
    try {
      await runAction(() => reconcileRevolutTransactionWithOrder(logId, orderId), 'Transferência Revolut conciliada com a limpeza.', 'Não foi possível conciliar a transferência.')
    } finally {
      setRevolutActionKey('')
    }
  }
  async function convertRevolutIncome(logId: string) {
    const category = revolutCategorySelections[logId] ?? 'outros'
    setRevolutActionKey(logId)
    try {
      await runAction(() => convertRevolutTransactionToExtraIncome(logId, category), 'Transferência Revolut registada como renda extra.', 'Não foi possível registar a renda extra.')
    } finally {
      setRevolutActionKey('')
    }
  }
  async function markOrderPaid(orderId: string) {
    setSavingOrderId(orderId)
    try {
      await runAction(() => markFinanceOrderPaid(orderId), 'Pagamento atualizado como pago.', 'Não foi possível atualizar o pagamento.')
    } finally {
      setSavingOrderId(null)
    }
  }

  const closeModal = useCallback(() => setModal(null), [])

  return <main className="min-w-0 space-y-5 pb-12 sm:space-y-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Planeamento</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#061121] sm:text-3xl">Assistente Financeiro</h1><p className="mt-1 text-sm text-slate-500">Uma visão prática para tomar decisões semanais com confiança.</p></div><div className="flex items-center gap-2"><a href={`/admin/financas?week=${shiftWeek(data.weekStart, -1)}`} aria-label="Semana anterior" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"><ArrowLeft className="h-4 w-4" /></a><span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black tabular-nums text-slate-700">{data.weekLabel}</span><a href={`/admin/financas?week=${shiftWeek(data.weekStart, 1)}`} aria-label="Semana seguinte" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"><ArrowRight className="h-4 w-4" /></a></div></div>
    {feedback && <p role="status" className={`rounded-xl border p-3 text-sm font-bold ${feedbackTone === 'success' ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{feedback}</p>}
    {data.warnings.length > 0 && <div role="status" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
      {data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
    </div>}
    {!data.paymentStatusAvailable && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Não é possível identificar cobranças pendentes porque o estado de pagamento não está disponível.</p>}
    {data.paymentStatusAvailable && !data.unpaidOrdersAvailable && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">Não foi possível carregar as cobranças pendentes.</p>}
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
            Limpezas realizadas: <span className="tabular-nums text-slate-200">{currency(data.realized)}</span>
            <span className="px-1.5 text-slate-600">•</span>
            Previstas: <span className="tabular-nums text-slate-200">{currency(data.forecast)}</span>
            <span className="px-1.5 text-slate-600">•</span>
            Renda extra: <span className="tabular-nums text-emerald-300">{currency(data.extraIncomeTotal)}</span>
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2.5 sm:px-4">
              <p className="text-[11px] font-medium leading-snug text-slate-400">Saldo disponível até domingo</p>
              <p className="mt-1 tabular-nums text-xl font-black text-cyan-200 sm:text-2xl">{currency(freeBalance)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 sm:px-4">
              <p className="text-[11px] font-medium leading-snug text-slate-400">Orçamento diário seguro</p>
              <p className="mt-1 tabular-nums text-base font-extrabold text-white sm:text-lg">{currency(dailySafe)}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            Saldo = realizadas ({currency(data.realized)}) + previstas ({currency(data.forecast)}) + renda extra ({currency(data.extraIncomeTotal)}) − impostos ({currency(fromCents(taxReserveCents))}) − operação ({currency(fromCents(businessOpsCents))}) − poupança ({currency(fromCents(savingsCents))}) − despesas ({currency(fromCents(expensesCents))}).
          </p>
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
            {simulationValueCents > 0 && <span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-bold ${simulatedBalanceCents >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {simulatedBalanceCents >= 0 ? `+${currency(fromCents(simulatedBalanceCents))}` : `−${currency(fromCents(Math.abs(simulatedBalanceCents)))}`}
            </span>}
          </div>
          {simulationValueCents > 0 && <p className={`mt-2 text-[11px] font-semibold ${simulatedBalanceCents >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {simulatedBalanceCents >= 0 ? 'Fica disponível após este gasto.' : 'Este valor ultrapassa o saldo seguro.'}
          </p>}
        </div>
      </aside>
    </section>

    <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Análise de despesas</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-[#061121]">Categorias & fluxo financeiro</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold shadow-sm" aria-label="Período analítico">
            <button type="button" aria-pressed={analysisPeriod === 'week'} onClick={() => { setAnalysisPeriod('week'); setFlowTooltip(null) }} className={`rounded-lg px-3 py-2 transition-colors ${analysisPeriod === 'week' ? 'bg-[#061121] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Esta Semana</button>
            <button type="button" aria-pressed={analysisPeriod === 'month'} onClick={() => { setAnalysisPeriod('month'); setFlowTooltip(null) }} className={`rounded-lg px-3 py-2 transition-colors ${analysisPeriod === 'month' ? 'bg-[#061121] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Este Mês</button>
          </div>
          <button type="button" onClick={() => exportPeriodCsv('week')} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:border-cyan-300 hover:text-cyan-800">Exportar semana CSV</button>
          <button type="button" onClick={() => exportPeriodCsv('month')} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:border-cyan-300 hover:text-cyan-800">Exportar mês CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {categoryGroupsWithTotals.map(({ key, label, Icon, color, tint, countLabel, amount, count, share, change }) => (
          <button key={key} type="button" aria-pressed={categoryFilter === key} onClick={() => { setCategoryFilter(categoryFilter === key ? null : key); setTab('expenses') }} className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${categoryFilter === key ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200/80'}`}>
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint} ${color}`}><Icon className="h-5 w-5" /></span>
              <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold tabular-nums text-slate-500">{change}</span>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-600">{label}</p>
            <p className="mt-1 tabular-nums text-xl font-black tracking-tight text-[#061121]">{currency(amount)}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500">
              <span>{count} {countLabel}{count === 1 ? '' : 's'} · {percentLabel(share)}% das despesas</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={`Distribuição de gastos por categoria · ${analysisPeriod === 'week' ? 'semana' : 'mês'}`}>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.2fr)] sm:items-center">
            <div className="relative mx-auto aspect-square w-full max-w-[190px]" aria-label={`Total de despesas: ${currency(analysisTotal)}`}>
              <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label="Gráfico circular das despesas por categoria">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="7" />
                {donutSegments.map((segment) => <circle key={segment.key} cx="21" cy="21" r="15.915" fill="transparent" stroke={segment.color} strokeWidth={highlightedSlice === segment.key ? 9 : 7} strokeDasharray={`${segment.percent} ${100 - segment.percent}`} strokeDashoffset={-segment.offset} className="cursor-pointer transition-all duration-200" role="button" tabIndex={0} aria-label={`${segment.label}: ${currency(segment.amount)}, ${segment.percent.toFixed(1)}%`} onMouseEnter={() => setHighlightedSlice(segment.key)} onMouseLeave={() => setHighlightedSlice(null)} onFocus={() => setHighlightedSlice(segment.key)} onBlur={() => setHighlightedSlice(null)} onClick={() => setHighlightedSlice(segment.key)} />)}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Total gasto</span>
                <strong className="mt-1 max-w-[90%] truncate tabular-nums text-base font-black text-[#061121]">{currency(analysisTotal)}</strong>
                {highlightedSlice && <span className="mt-0.5 max-w-[90%] truncate text-[9px] font-semibold text-slate-500">{expenseCategoryLabels[highlightedSlice]}</span>}
              </div>
            </div>
            <div className="space-y-2.5">
              {categoryTotals.map((category) => {
                const percent = analysisTotal > 0 ? category.amount / analysisTotal * 100 : 0
                const CategoryIcon = category.Icon
                return <button key={category.key} type="button" onMouseEnter={() => setHighlightedSlice(category.key)} onMouseLeave={() => setHighlightedSlice(null)} onFocus={() => setHighlightedSlice(category.key)} onBlur={() => setHighlightedSlice(null)} onClick={() => setHighlightedSlice(category.key)} className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                  <span className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="flex min-w-0 items-center gap-2 font-bold text-slate-600"><CategoryIcon className="h-3.5 w-3.5 shrink-0" style={{ color: category.color }} />{category.label}</span>
                    <span className="shrink-0 tabular-nums font-extrabold text-slate-800">{currency(category.amount)} <span className="font-semibold text-slate-400">({percentLabel(percent)}%)</span></span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${percent}%`, backgroundColor: category.color }} />
                  </span>
                </button>
              })}
              {analysisTotal === 0 && <p className="text-center text-[11px] font-medium text-slate-400">Sem despesas registadas neste período.</p>}
            </div>
          </div>
        </ChartCard>

        <ChartCard title={`Fluxo financeiro · ${analysisPeriod === 'week' ? 'por dia da semana' : 'por semana do mês'}`}>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[9px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-cyan-500" />Limpezas</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-500" />Rendas extra</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#061121]" />Pessoal</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-rose-400" />R&R</span>
          </div>
          <div className="mt-4 flex h-48 items-end gap-1 border-b border-slate-200 px-1 sm:gap-2">
            {flowItems.map((item) => {
              const series = [
                { key: 'cleaning', value: item.cleaning, color: 'bg-cyan-500', label: 'Limpezas concluídas' },
                { key: 'extra', value: item.extra, color: 'bg-emerald-500', label: 'Rendas extra' },
                { key: 'personal', value: item.personal, color: 'bg-[#061121]', label: 'Despesas pessoais' },
                { key: 'business', value: item.business, color: 'bg-rose-400', label: 'Despesas R&R' },
              ]
              return <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <div className="flex h-[calc(100%-1.5rem)] w-full items-end justify-center gap-0.5 sm:gap-1" title={`${item.label}: entradas ${currency(item.cleaning + item.extra)} · saídas ${currency(item.personal + item.business)}`}>
                  {series.map((bar) => {
                    const id = `${item.label}-${bar.key}`
                    return <button key={bar.key} type="button" title={`${item.label} · ${bar.label}: ${currency(bar.value)}`} aria-label={`${item.label} · ${bar.label}: ${currency(bar.value)}`} onMouseEnter={() => setFlowTooltip({ id, label: item.label, series: bar.label, value: bar.value })} onFocus={() => setFlowTooltip({ id, label: item.label, series: bar.label, value: bar.value })} onClick={() => setFlowTooltip({ id, label: item.label, series: bar.label, value: bar.value })} className={`w-full max-w-3 rounded-t-sm transition-[height] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-600 ${bar.color}`} style={{ height: `${bar.value > 0 ? Math.max(2, bar.value / flowMax * 100) : 0}%` }} />
                  })}
                </div>
                <span className="mt-1.5 h-4 text-center text-[9px] font-bold capitalize text-slate-500">{item.label}</span>
              </div>
            })}
          </div>
          {flowTooltip
            ? <p role="status" className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-600">{flowTooltip.label} · {flowTooltip.series}: <span className="tabular-nums font-black text-[#061121]">{currency(flowTooltip.value)}</span></p>
            : <p className="mt-3 text-[10px] text-slate-500">Passe ou toque nas barras para consultar os valores de cada período.</p>}
        </ChartCard>
      </div>
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
            {categoryFilter && <button type="button" onClick={() => setCategoryFilter(null)} className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-[10px] font-bold text-cyan-900 hover:bg-cyan-100">Limpar filtro de {categoryGroups.find((group) => group.key === categoryFilter)?.label}</button>}
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
                  <span>{expenseCategoryLabels[normalizeExpenseCategory(item.category)]}</span><span>·</span><span>{dateLabel(item.expense_date)}</span>
                  {item.is_recurring_weekly && <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-bold text-cyan-800">Semanal</span>}
                  {item.is_recurring_monthly && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800">Mensal · dia {item.recurrence_day}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pl-12 sm:pl-0">
              <span className="mr-auto tabular-nums text-xs font-extrabold text-slate-900 sm:mr-1">{currency(item.amount)}</span>
              {(item.is_recurring_weekly || item.is_recurring_monthly) && <button type="button" onClick={() => void toggleRecurring(item)} className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-800 transition-colors hover:bg-amber-100">Desativar</button>}
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
              {formatFinanceDate(item.date, { day: '2-digit', month: '2-digit' })}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-slate-800">{item.title}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                {item.kind === 'expense' ? `Gasto · ${expenseCategoryLabels[normalizeExpenseCategory(item.category)]}${item.is_recurring_weekly ? ' · Semanal' : ''}${item.is_recurring_monthly ? ` · Mensal (${item.recurrence_day ?? 'dia original'})` : ''}` : `Renda extra · ${incomeLabels[item.category]}`}
              </p>
              {item.kind === 'expense' && (item.is_recurring_monthly || item.is_recurring_weekly) && <span className="mt-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Recorrente</span>}
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
    {data.paymentStatusAvailable && data.unpaidOrdersAvailable && <section className="rounded-2xl border border-amber-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 border-b border-amber-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-black text-[#061121]">Cobranças pendentes</h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Serviços cujo pagamento ainda não está marcado como recebido.</p>
        </div>
        {data.unpaidOrders.length > 0 && <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">{data.unpaidOrders.length} por cobrar</span>}
      </div>
      {data.unpaidOrders.length > 0 ? <div className="divide-y divide-slate-100">
        {data.unpaidOrders.map((order) => {
          const scheduledDate = financeDateForInstant(order.scheduled_date)
          const daysLate = financeDayDifference(scheduledDate, data.today)
          return <div key={order.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">{order.client_name} · {order.service_type}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {dateLabel(scheduledDate)} · {daysLate > 0 ? `${daysLate} ${daysLate === 1 ? 'dia' : 'dias'} de atraso` : daysLate === 0 ? 'Agendado para hoje' : `Faltam ${Math.abs(daysLate)} ${Math.abs(daysLate) === 1 ? 'dia' : 'dias'}`}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="tabular-nums text-xs font-extrabold text-amber-800">{currency(order.total_amount)}</span>
              <button type="button" onClick={() => void markOrderPaid(order.id)} disabled={savingOrderId === order.id} className="min-h-10 rounded-lg bg-[#061121] px-3 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
                {savingOrderId === order.id ? 'A atualizar…' : 'Marcar como pago'}
              </button>
            </div>
          </div>
        })}
      </div> : <p className="py-5 text-center text-xs font-semibold text-slate-500">Não existem cobranças pendentes.</p>}
    </section>}

    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-cyan-600" />
        <h2 className="text-sm font-black text-[#061121]">Receita das limpezas</h2>
      </div>
      {data.orders.length > 0 ? data.orders.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-800">{statusLabels[item.status] ?? item.status}</p>
          <p className="text-[10px] tabular-nums text-slate-500">{formatFinanceDateTime(item.scheduled_date)}</p>
        </div>
        <span className="shrink-0 tabular-nums text-xs font-extrabold text-slate-900">{currency(item.total_amount)}</span>
      </div>) : <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">Ainda não há limpezas registadas nesta semana.</p>}
    </section>

    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><CircleDollarSign className="h-4 w-4" /></span>
            <h2 className="text-sm font-black text-[#061121]">Movimentos Revolut (Tempo Real)</h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Notificações recebidas e processadas pelo webhook.</p>
        </div>
        {data.revolutAvailable
          ? <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Webhook Ativo • Tempo Real
          </span>
          : <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-900">Integração Revolut indisponível</span>}
      </div>

      {!data.revolutAvailable && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Não foi possível carregar os movimentos Revolut. O restante painel financeiro continua disponível.</p>}
      <div className="grid gap-5 pt-4 xl:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-black text-slate-800">Transferências a rever</h3>
            {pendingRevolutTransactions.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">{pendingRevolutTransactions.length} pendente{pendingRevolutTransactions.length === 1 ? '' : 's'}</span>}
          </div>
          {pendingRevolutTransactions.length > 0 ? <div className="space-y-2">
            {pendingRevolutTransactions.map((transaction) => {
              const matchingOrders = data.unpaidOrders.filter((order) => order.total_amount === transaction.amount)
              const selectedOrderId = revolutOrderSelections[transaction.bank_tx_id] ?? ''
              const category = revolutCategorySelections[transaction.bank_tx_id] ?? 'outros'
              const isSaving = revolutActionKey === transaction.bank_tx_id

              return <article key={transaction.bank_tx_id} className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{transaction.counterparty_name ?? transaction.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{formatFinanceDateTime(transaction.transaction_at)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums text-xs font-extrabold text-emerald-700">+ {currency(transaction.amount)}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="min-w-0">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-600">Limpeza não paga</span>
                    <select value={selectedOrderId} onChange={(event) => setRevolutOrderSelections({ ...revolutOrderSelections, [transaction.bank_tx_id]: event.target.value })} disabled={isSaving || matchingOrders.length === 0} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:bg-slate-100">
                      <option value="">{matchingOrders.length === 0 ? 'Sem limpeza pendente deste valor' : 'Selecionar limpeza correspondente'}</option>
                      {matchingOrders.map((order) => <option key={order.id} value={order.id}>
                        {dateLabel(financeDateForInstant(order.scheduled_date))} · {order.service_type} · {currency(order.total_amount)}
                      </option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => void reconcileRevolutTransaction(transaction.bank_tx_id)} disabled={!selectedOrderId || isSaving} className="mt-auto inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#061121] px-3 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <BadgeCheck className="h-3.5 w-3.5" /> {isSaving ? 'A guardar…' : 'Marcar Paga'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Categoria da renda extra</span>
                    <select value={category} onChange={(event) => setRevolutCategorySelections({ ...revolutCategorySelections, [transaction.bank_tx_id]: event.target.value as FinanceExtraIncome['category'] })} disabled={isSaving} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:bg-slate-100">
                      {(Object.entries(incomeLabels) as [FinanceExtraIncome['category'], string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => void convertRevolutIncome(transaction.bank_tx_id)} disabled={isSaving} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-bold text-cyan-900 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSaving ? 'A guardar…' : 'Renda Extra'}
                  </button>
                </div>
              </article>
            })}
          </div> : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500">Não há transferências por conciliar.</p>}
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-black text-slate-800">Últimas movimentações processadas</h3>
          {processedRevolutTransactions.length > 0 ? <div className="divide-y divide-slate-100">
            {processedRevolutTransactions.slice(0, 10).map((transaction) => {
              const status = transaction.direction === 'expense' ? 'Despesa registada' : transaction.matched_order_id ? 'Limpeza paga' : 'Renda extra'
              const label = transaction.merchant_name ?? transaction.counterparty_name ?? transaction.category

              return <div key={transaction.bank_tx_id} className="flex items-center gap-2.5 py-2.5 first:pt-1">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${transaction.direction === 'expense' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {transaction.direction === 'expense' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{label}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                    <span>{formatFinanceDateTime(transaction.transaction_at)}</span>
                    <span>{status}</span>
                  </div>
                </div>
                <span className={`shrink-0 tabular-nums text-xs font-extrabold ${transaction.direction === 'expense' ? 'text-slate-800' : 'text-emerald-700'}`}>
                  {transaction.direction === 'expense' ? '− ' : '+ '}{currency(Math.abs(transaction.amount))}
                </span>
              </div>
            })}
          </div> : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500">Ainda não há movimentos processados automaticamente.</p>}
        </div>
      </div>
    </section>

    {modal === 'expense' && <Modal title="Registar gasto" close={closeModal}>
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
            <select name="category" required value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
              {expenseCategories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </select>
          </label>
        </div>
        <label className="flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-700">
          <input name="is_recurring_weekly" type="checkbox" checked={expense.is_recurring_weekly} onChange={(e) => setExpense({ ...expense, is_recurring_weekly: e.target.checked })} className="h-4 w-4 min-h-0 rounded border-slate-300 accent-cyan-600" />
          Repetir todas as semanas
        </label>
        <label className="flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-700">
          <input name="is_recurring_monthly" type="checkbox" checked={expense.is_recurring_monthly} onChange={(e) => setExpense({ ...expense, is_recurring_monthly: e.target.checked })} className="h-4 w-4 min-h-0 rounded border-slate-300 accent-cyan-600" />
          Repetir todos os meses neste dia
        </label>
        {expense.is_recurring_monthly && <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dia mensal
          <input name="recurrence_day" type="number" min="1" max="31" value={expense.recurrence_day} onChange={(e) => setExpense({ ...expense, recurrence_day: e.target.value })} className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" placeholder="Usa o dia da data se vazio" />
        </label>}
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notas
          <textarea name="notes" value={expense.notes} onChange={(e) => setExpense({ ...expense, notes: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50/70 p-3 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
        </label>
        <SubmitButton saving={saving} label="Guardar gasto" />
      </form>
    </Modal>}
    {modal === 'income' && <Modal title="Registar renda extra" close={closeModal}>
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
    {modal === 'rules' && <Modal title="Configurar regras (%)" close={closeModal}>
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

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
    getFocusable()[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault()
        focusable[focusable.length - 1].focus()
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault()
        focusable[0].focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [close])

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#061121]/60 p-4">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="finance-modal-title" tabIndex={-1} className="my-6 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="mb-5 flex items-start justify-between">
        <h2 id="finance-modal-title" className="text-xl font-black text-[#061121]">{title}</h2>
        <button type="button" onClick={close} aria-label="Fechar" className="min-h-10 min-w-10 rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </div>
  </div>
}
function SubmitButton({ saving, label }: { saving: boolean; label: string }) { return <div className="flex justify-end"><button disabled={saving} className="min-h-11 rounded-xl bg-[#061121] px-5 text-xs font-black text-white disabled:opacity-50">{saving ? 'A guardar...' : label}</button></div> }
