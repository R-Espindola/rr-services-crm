import { getAdminSession } from '@/lib/admin-auth'
import FinanceDashboard, { type FinanceData, type FinanceExpense, type FinanceExtraIncome, type FinanceOrderSummary, type FinanceRules } from './FinanceDashboard'

const activeStatuses = ['pending', 'confirmed', 'en_route', 'in_progress']
const FINANCE_RULES_ID = '00000000-0000-0000-0000-000000000001'
const dateOnly = (date: Date) => date.toISOString().slice(0, 10)
const money = (value: unknown) => typeof value === 'number' ? value : Number(value ?? 0)

function mondayOf(value: string | undefined) {
  const candidate = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date()
  const offset = candidate.getDay() === 0 ? -6 : 1 - candidate.getDay()
  candidate.setDate(candidate.getDate() + offset)
  return dateOnly(candidate)
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return dateOnly(date)
}

function localDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function occurrenceDates(start: string, endExclusive: string, day: number) {
  const dates: string[] = []
  const cursor = new Date(`${start}T12:00:00`)
  const end = new Date(`${endExclusive}T12:00:00`)
  while (cursor < end) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const dueDate = dateOnly(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, lastDay)))
    if (dueDate >= start && dueDate < endExclusive && !dates.includes(dueDate)) dates.push(dueDate)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

type ExpenseRow = { id: string; title: string; amount: number | string; expense_type: 'personal' | 'business'; category: string; expense_date: string; is_recurring_weekly: boolean; is_recurring_monthly: boolean; recurrence_day: number | null; notes: string | null; is_virtual_recurring?: boolean }
type IncomeRow = { id: string; title: string; amount: number | string; category: 'freelance_web' | 'bonus_servico' | 'vendas' | 'reembolso' | 'outros'; income_date: string; notes: string | null }
type RevolutTransactionRow = { bank_tx_id: string; title: string; amount: number | string; direction: 'expense' | 'income'; merchant_name: string | null; counterparty_name: string | null; transaction_at: string; category: string; matched_order_id: string | null; converted_extra_income_id: string | null }
type UnpaidOrderRow = { id: string; service_type: string; total_amount: number | string; scheduled_date: string }

export default async function AdminFinancasPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await getAdminSession()
  if (!session.success) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-800">{session.error}</div>
  const params = await searchParams
  const weekStart = mondayOf(params.week)
  const weekEndExclusive = addDays(weekStart, 7)
  const previousWeekStart = addDays(weekStart, -7)
  const currentDate = new Date()
  const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const nextMonthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
  const previousMonthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
  const monthStart = localDateOnly(monthStartDate)
  const monthEndExclusive = localDateOnly(nextMonthStartDate)
  const previousMonthStart = localDateOnly(previousMonthStartDate)
  const today = dateOnly(new Date())
  const upcomingEnd = addDays(today, 36)
  const [{ data: rulesRow }, { data: orders, error: ordersError }, { data: weekExpenses, error: expensesError }, { data: recurringExpenses, error: recurringError }, { data: futureExpenses, error: futureExpensesError }, { data: extraIncomes, error: incomeError }, { data: futureIncomes, error: futureIncomeError }, { data: revolutTransactions, error: revolutError }, { data: unpaidOrders, error: unpaidOrdersError }, { data: monthExpenses, error: monthExpensesError }, { data: previousMonthExpenses, error: previousMonthExpensesError }, { data: previousWeekExpenses, error: previousWeekExpensesError }, { data: monthOrders, error: monthOrdersError }, { data: monthExtraIncomes, error: monthIncomeError }] = await Promise.all([
    session.supabase.from('finance_allocation_rules').select('tax_reserve_pct, business_ops_pct, personal_weekly_pct, savings_pct, weekly_fixed_target').eq('id', FINANCE_RULES_ID).maybeSingle(),
    session.supabase.from('orders').select('id, status, total_amount, scheduled_date').gte('scheduled_date', `${weekStart}T00:00:00.000Z`).lt('scheduled_date', `${weekEndExclusive}T00:00:00.000Z`).in('status', ['completed', ...activeStatuses]).order('scheduled_date', { ascending: true }),
    session.supabase.from('finance_expenses').select('id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, recurrence_day, notes').gte('expense_date', weekStart).lt('expense_date', weekEndExclusive).order('expense_date', { ascending: false }),
    session.supabase.from('finance_expenses').select('id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, recurrence_day, notes').eq('is_recurring_monthly', true).order('expense_date', { ascending: false }),
    session.supabase.from('finance_expenses').select('id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, recurrence_day, notes').gte('expense_date', today).lt('expense_date', upcomingEnd).order('expense_date', { ascending: true }),
    session.supabase.from('finance_extra_incomes').select('id, title, amount, category, income_date, notes').gte('income_date', weekStart).lt('income_date', weekEndExclusive).order('income_date', { ascending: false }),
    session.supabase.from('finance_extra_incomes').select('id, title, amount, category, income_date, notes').gte('income_date', today).lt('income_date', upcomingEnd).order('income_date', { ascending: true }),
    session.supabase.from('revolut_transactions_log').select('bank_tx_id, title, amount, direction, merchant_name, counterparty_name, transaction_at, category, matched_order_id, converted_extra_income_id').order('created_at', { ascending: false }).limit(20),
    session.supabase.from('orders').select('id, service_type, total_amount, scheduled_date').neq('payment_status', 'paid').neq('status', 'cancelled').order('scheduled_date', { ascending: true }),
    session.supabase.from('finance_expenses').select('id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, recurrence_day, notes').gte('expense_date', monthStart).lt('expense_date', monthEndExclusive).order('expense_date', { ascending: false }),
    session.supabase.from('finance_expenses').select('id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, recurrence_day, notes').gte('expense_date', previousMonthStart).lt('expense_date', monthStart).order('expense_date', { ascending: false }),
    session.supabase.from('finance_expenses').select('id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, recurrence_day, notes').gte('expense_date', previousWeekStart).lt('expense_date', weekStart).order('expense_date', { ascending: false }),
    session.supabase.from('orders').select('id, status, total_amount, scheduled_date').eq('status', 'completed').gte('scheduled_date', `${monthStart}T00:00:00.000Z`).lt('scheduled_date', `${monthEndExclusive}T00:00:00.000Z`).order('scheduled_date', { ascending: true }),
    session.supabase.from('finance_extra_incomes').select('id, title, amount, category, income_date, notes').gte('income_date', monthStart).lt('income_date', monthEndExclusive).order('income_date', { ascending: false }),
  ])
  if (ordersError || expensesError || recurringError || futureExpensesError || incomeError || futureIncomeError || revolutError || unpaidOrdersError || monthExpensesError || previousMonthExpensesError || previousWeekExpensesError || monthOrdersError || monthIncomeError) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-800">Não foi possível carregar os dados financeiros. Verifique se as migrações do Assistente Financeiro e Revolut já foram aplicadas.</div>
  const rules: FinanceRules = { tax_reserve_pct: money(rulesRow?.tax_reserve_pct ?? 20), business_ops_pct: money(rulesRow?.business_ops_pct ?? 20), personal_weekly_pct: money(rulesRow?.personal_weekly_pct ?? 40), savings_pct: money(rulesRow?.savings_pct ?? 20), weekly_fixed_target: money(rulesRow?.weekly_fixed_target ?? 0) }
  const orderRows = (orders ?? []) as Array<{ id: string; status: string; total_amount: number | string | null; scheduled_date: string }>
  const weekRows = (weekExpenses ?? []) as ExpenseRow[]
  const previousWeekRows = (previousWeekExpenses ?? []) as ExpenseRow[]
  const recurringRows = (recurringExpenses ?? []) as ExpenseRow[]
  const recurringActuals = new Set(weekRows.filter((item) => item.is_recurring_monthly).map((item) => `${item.id}:${item.expense_date}`))
  const weekOccurrences = recurringRows.flatMap((item) => !item.recurrence_day ? [] : occurrenceDates(weekStart, weekEndExclusive, item.recurrence_day).filter((date) => !recurringActuals.has(`${item.id}:${date}`)).map((date): ExpenseRow => ({ ...item, id: `${item.id}:${date}`, expense_date: date, is_virtual_recurring: true })))
  const expenseRows = [...weekRows, ...weekOccurrences]
  const previousWeekActuals = new Set(previousWeekRows.filter((item) => item.is_recurring_monthly).map((item) => `${item.id}:${item.expense_date}`))
  const previousWeekOccurrences = recurringRows.flatMap((item) => !item.recurrence_day ? [] : occurrenceDates(previousWeekStart, weekStart, item.recurrence_day).filter((date) => !previousWeekActuals.has(`${item.id}:${date}`)).map((date): ExpenseRow => ({ ...item, id: `${item.id}:${date}`, expense_date: date, is_virtual_recurring: true })))
  const previousWeekExpenseRows = [...previousWeekRows, ...previousWeekOccurrences]
  const futureRows = (futureExpenses ?? []) as ExpenseRow[]
  const futureActuals = new Set(futureRows.filter((item) => item.is_recurring_monthly).map((item) => `${item.id}:${item.expense_date}`))
  const futureOccurrences = recurringRows.flatMap((item) => !item.recurrence_day ? [] : occurrenceDates(today, upcomingEnd, item.recurrence_day).filter((date) => !futureActuals.has(`${item.id}:${date}`)).map((date): ExpenseRow => ({ ...item, id: `${item.id}:${date}`, expense_date: date, is_virtual_recurring: true })))
  const upcomingExpenses = [...futureRows, ...futureOccurrences].filter((item) => item.expense_date >= today && item.expense_date < upcomingEnd)
  const incomeRows = (extraIncomes ?? []) as IncomeRow[]
  const monthExpenseRows = (monthExpenses ?? []) as ExpenseRow[]
  const previousMonthExpenseRows = (previousMonthExpenses ?? []) as ExpenseRow[]
  const monthActuals = new Set(monthExpenseRows.filter((item) => item.is_recurring_monthly).map((item) => `${item.id}:${item.expense_date}`))
  const monthOccurrences = recurringRows.flatMap((item) => !item.recurrence_day ? [] : occurrenceDates(monthStart, monthEndExclusive, item.recurrence_day).filter((date) => !monthActuals.has(`${item.id}:${date}`)).map((date): ExpenseRow => ({ ...item, id: `${item.id}:${date}`, expense_date: date, is_virtual_recurring: true })))
  const previousMonthActuals = new Set(previousMonthExpenseRows.filter((item) => item.is_recurring_monthly).map((item) => `${item.id}:${item.expense_date}`))
  const previousMonthOccurrences = recurringRows.flatMap((item) => !item.recurrence_day ? [] : occurrenceDates(previousMonthStart, monthStart, item.recurrence_day).filter((date) => !previousMonthActuals.has(`${item.id}:${date}`)).map((date): ExpenseRow => ({ ...item, id: `${item.id}:${date}`, expense_date: date, is_virtual_recurring: true })))
  const monthlyExpenseRows = [...monthExpenseRows, ...monthOccurrences]
  const previousMonthlyExpenseRows = [...previousMonthExpenseRows, ...previousMonthOccurrences]
  const monthOrderRows = (monthOrders ?? []) as Array<{ id: string; status: string; total_amount: number | string | null; scheduled_date: string }>
  const monthIncomeRows = (monthExtraIncomes ?? []) as IncomeRow[]
  const upcomingIncomeRows = (futureIncomes ?? []) as IncomeRow[]
  const revolutRows = (revolutTransactions ?? []) as RevolutTransactionRow[]
  const unpaidOrderRows = (unpaidOrders ?? []) as UnpaidOrderRow[]
  const realized = orderRows.filter((order) => order.status === 'completed').reduce((sum, order) => sum + money(order.total_amount), 0)
  const forecast = orderRows.filter((order) => activeStatuses.includes(order.status)).reduce((sum, order) => sum + money(order.total_amount), 0)
  const personalExpenses = expenseRows.filter((item) => item.expense_type === 'personal').reduce((sum, item) => sum + money(item.amount), 0)
  const businessExpenses = expenseRows.filter((item) => item.expense_type === 'business').reduce((sum, item) => sum + money(item.amount), 0)
  const extraIncomeTotal = incomeRows.reduce((sum, income) => sum + money(income.amount), 0)
  const endDate = new Date(`${weekEndExclusive}T00:00:00`)
  const daysRemaining = Math.max(1, Math.ceil((endDate.getTime() - currentDate.getTime()) / 86_400_000))
  const data: FinanceData = {
    weekStart, weekEnd: addDays(weekStart, 6), weekLabel: `${new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(new Date(`${weekStart}T12:00:00`))} – ${new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${addDays(weekStart, 6)}T12:00:00`))}`, monthStart,
    realized, forecast, cleaningGross: realized + forecast, extraIncomeTotal, gross: realized + forecast + extraIncomeTotal, expensesTotal: personalExpenses + businessExpenses, personalExpenses, businessExpenses, daysRemaining, rules,
    expenses: expenseRows.map((item): FinanceExpense => ({ ...item, amount: money(item.amount), notes: item.notes ?? '', is_virtual_recurring: item.is_virtual_recurring ?? false })),
    previousWeekExpenses: previousWeekExpenseRows.map((item): FinanceExpense => ({ ...item, amount: money(item.amount), notes: item.notes ?? '', is_virtual_recurring: item.is_virtual_recurring ?? false })),
    monthExpenses: monthlyExpenseRows.map((item): FinanceExpense => ({ ...item, amount: money(item.amount), notes: item.notes ?? '', is_virtual_recurring: item.is_virtual_recurring ?? false })),
    previousMonthExpenses: previousMonthlyExpenseRows.map((item): FinanceExpense => ({ ...item, amount: money(item.amount), notes: item.notes ?? '', is_virtual_recurring: item.is_virtual_recurring ?? false })),
    extraIncomes: incomeRows.map((item): FinanceExtraIncome => ({ ...item, amount: money(item.amount), notes: item.notes ?? '' })),
    monthExtraIncomes: monthIncomeRows.map((item): FinanceExtraIncome => ({ ...item, amount: money(item.amount), notes: item.notes ?? '' })),
    monthOrders: monthOrderRows.map((item): FinanceOrderSummary => ({ ...item, total_amount: money(item.total_amount) })),
    upcomingExpenses: upcomingExpenses.map((item): FinanceExpense => ({ ...item, amount: money(item.amount), notes: item.notes ?? '', is_virtual_recurring: item.is_virtual_recurring ?? false })),
    upcomingExtraIncomes: upcomingIncomeRows.map((item): FinanceExtraIncome => ({ ...item, amount: money(item.amount), notes: item.notes ?? '' })),
    orders: orderRows.map((item): FinanceOrderSummary => ({ ...item, total_amount: money(item.total_amount) })),
    revolutTransactions: revolutRows.map((item) => ({ ...item, amount: money(item.amount) })),
    unpaidOrders: unpaidOrderRows.map((item) => ({ ...item, total_amount: money(item.total_amount) })),
  }
  return <FinanceDashboard data={data} />
}
