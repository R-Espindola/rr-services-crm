import { z } from 'zod'
import { getAdminSession } from '@/lib/admin-auth'
import {
  addFinanceDays,
  financeDateToUtcIso,
  financeDayDifference,
  isFinanceDateKey,
  financeMonthRange,
  financeToday,
  financeWeekRange,
} from '@/lib/finance/dates'
import { generateExpenseOccurrences } from '@/lib/finance/recurrences'
import { fromCents, toCents, sumCents } from '@/lib/finance/money'
import FinanceDashboard, {
  type FinanceData,
  type FinanceExpense,
  type FinanceExtraIncome,
  type FinanceOrderSummary,
  type FinanceRules,
  type FinanceUnpaidOrder,
  type FinanceRevolutTransaction,
} from './FinanceDashboard'

const activeStatuses = ['pending', 'confirmed', 'en_route', 'in_progress']
const FINANCE_RULES_ID = '00000000-0000-0000-0000-000000000001'
const expenseColumns = 'id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, recurrence_day, notes'
const monthlyExpenseColumns = 'id, title, amount, expense_type, category, expense_date, is_recurring_weekly, is_recurring_monthly, notes'
const legacyExpenseColumns = 'id, title, amount, expense_type, category, expense_date, is_recurring_weekly, notes'

type AdminSupabase = Extract<Awaited<ReturnType<typeof getAdminSession>>, { success: true }>['supabase']
type SupabaseError = { message: string; details?: string | null; code: string; hint?: string | null }
type SupabaseResponse = { data: unknown; error: SupabaseError | null }
type FinanceExpenseRow = {
  id: string
  title: string
  amount: number | string
  expense_type: 'personal' | 'business'
  category: string
  expense_date: string
  is_recurring_weekly: boolean
  is_recurring_monthly: boolean
  recurrence_day: number | null
  notes: string
}
type FinanceOrderRow = { id: string; status: string; total_amount: number | string | null; scheduled_date: string; payment_status?: string | null }
type LoadResult<T> = { data: T; error: boolean; warning?: string }

const amountSchema = z.union([z.number(), z.string()])
const expenseRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  amount: amountSchema,
  expense_type: z.enum(['personal', 'business']),
  category: z.string(),
  expense_date: z.string(),
  is_recurring_weekly: z.boolean().nullable().optional(),
  is_recurring_monthly: z.boolean().nullable().optional(),
  recurrence_day: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
})
const incomeRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  amount: amountSchema,
  category: z.enum(['freelance_web', 'bonus_servico', 'vendas', 'reembolso', 'outros']),
  income_date: z.string(),
  notes: z.string().nullable().optional(),
})
const orderRowSchema = z.object({
  id: z.string(),
  status: z.string(),
  total_amount: amountSchema.nullable(),
  scheduled_date: z.string(),
  payment_status: z.string().nullable().optional(),
})
const unpaidOrderRowSchema = orderRowSchema.extend({
  service_type: z.string(),
  clients: z.union([
    z.object({ name: z.string().nullable() }).nullable(),
    z.array(z.object({ name: z.string().nullable() })),
  ]).optional(),
})
const revolutRowSchema = z.object({
  bank_tx_id: z.string(),
  title: z.string(),
  amount: amountSchema,
  direction: z.enum(['expense', 'income']),
  merchant_name: z.string().nullable(),
  counterparty_name: z.string().nullable(),
  transaction_at: z.string(),
  category: z.string(),
  matched_order_id: z.string().nullable(),
  converted_extra_income_id: z.string().nullable().optional(),
})
const rulesRowSchema = z.object({
  tax_reserve_pct: amountSchema,
  business_ops_pct: amountSchema,
  personal_weekly_pct: amountSchema,
  savings_pct: amountSchema,
  weekly_fixed_target: amountSchema,
})

const defaultRules: FinanceRules = {
  tax_reserve_pct: 20,
  business_ops_pct: 20,
  personal_weekly_pct: 40,
  savings_pct: 20,
  weekly_fixed_target: 0,
}

function logSupabaseError(context: string, error: SupabaseError) {
  console.error(`[Finanças] ${context}`, {
    message: error.message,
    details: error.details ?? null,
    code: error.code,
  })
}

function logUnexpectedError(context: string, error: unknown) {
  console.error(`[Finanças] ${context}`, {
    message: error instanceof Error ? error.message : 'Erro inesperado.',
    details: null,
    code: 'UNEXPECTED',
  })
}

async function runQuery(context: string, query: PromiseLike<SupabaseResponse>): Promise<SupabaseResponse> {
  try {
    const result = await query
    if (result.error) logSupabaseError(context, result.error)
    return result
  } catch (error) {
    logUnexpectedError(context, error)
    return { data: null, error: { message: 'Erro inesperado na consulta.', details: null, code: 'UNEXPECTED' } }
  }
}

function isMissingColumn(error: SupabaseError, column: string) {
  const text = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return ['42703', 'PGRST204', 'PGRST200', 'PGRST100'].includes(error.code)
    && text.includes(column.toLowerCase())
}

function parseRows<T>(schema: z.ZodType<T>, value: unknown, context: string): T[] {
  const result = z.array(schema).safeParse(value ?? [])
  if (!result.success) {
    console.error(`[Finanças] Dados inválidos recebidos em ${context}.`, result.error.issues)
    return []
  }
  return result.data
}

function mapExpense(row: z.infer<typeof expenseRowSchema>): FinanceExpenseRow {
  return {
    ...row,
    amount: fromCents(toCents(row.amount)),
    is_recurring_weekly: row.is_recurring_weekly ?? false,
    is_recurring_monthly: row.is_recurring_monthly ?? false,
    recurrence_day: row.recurrence_day ?? null,
    notes: row.notes ?? '',
  }
}

function mapFinanceExpense(row: FinanceExpenseRow, virtual = false): FinanceExpense {
  return {
    ...row,
    amount: fromCents(toCents(row.amount)),
    is_virtual_recurring: virtual,
  }
}

function parseIncomeRows(value: unknown, context: string): FinanceExtraIncome[] {
  return parseRows(incomeRowSchema, value, context).map((row) => ({
    ...row,
    amount: fromCents(toCents(row.amount)),
    notes: row.notes ?? '',
  }))
}

function parseOrderRows(value: unknown, context: string): FinanceOrderRow[] {
  return parseRows(orderRowSchema, value, context).map((row) => ({
    ...row,
    total_amount: row.total_amount === null ? 0 : fromCents(toCents(row.total_amount)),
  }))
}

async function loadExpenseRange(
  supabase: AdminSupabase,
  start: string,
  endExclusive: string,
  context: string,
): Promise<LoadResult<FinanceExpenseRow[]>> {
  let result = await runQuery(
    context,
    supabase.from('finance_expenses').select(expenseColumns).gte('expense_date', start).lt('expense_date', endExclusive).order('expense_date', { ascending: false }),
  )

  if (result.error && isMissingColumn(result.error, 'recurrence_day')) {
    result = await runQuery(
      `${context} (compatibilidade sem dia de recorrência)`,
      supabase.from('finance_expenses').select(monthlyExpenseColumns).gte('expense_date', start).lt('expense_date', endExclusive).order('expense_date', { ascending: false }),
    )
    if (!result.error) {
      return {
        data: parseRows(expenseRowSchema, result.data, context).map(mapExpense),
        error: false,
        warning: 'A coluna recurrence_day não está disponível; as recorrências mensais usam o dia da despesa original.',
      }
    }
  }

  if (result.error && (isMissingColumn(result.error, 'is_recurring_monthly') || isMissingColumn(result.error, 'recurrence_day'))) {
    result = await runQuery(
      `${context} (compatibilidade sem recorrência mensal)`,
      supabase.from('finance_expenses').select(legacyExpenseColumns).gte('expense_date', start).lt('expense_date', endExclusive).order('expense_date', { ascending: false }),
    )
    if (result.error) return { data: [], error: true }
    return {
      data: parseRows(expenseRowSchema, result.data, context).map(mapExpense),
      error: false,
      warning: 'A migração de recorrências mensais não está aplicada; estas projeções estão indisponíveis.',
    }
  }

  if (result.error) return { data: [], error: true }
  return { data: parseRows(expenseRowSchema, result.data, context).map(mapExpense), error: false }
}

async function loadRecurringExpenses(supabase: AdminSupabase): Promise<LoadResult<FinanceExpenseRow[]>> {
  let result = await runQuery(
    'Carregamento de despesas recorrentes',
    supabase.from('finance_expenses').select(expenseColumns).or('is_recurring_weekly.eq.true,is_recurring_monthly.eq.true').order('expense_date', { ascending: false }),
  )

  if (result.error && isMissingColumn(result.error, 'recurrence_day')) {
    result = await runQuery(
      'Carregamento de recorrências (compatibilidade sem dia de recorrência)',
      supabase.from('finance_expenses').select(monthlyExpenseColumns).or('is_recurring_weekly.eq.true,is_recurring_monthly.eq.true').order('expense_date', { ascending: false }),
    )
    if (!result.error) {
      return {
        data: parseRows(expenseRowSchema, result.data, 'despesas recorrentes').map(mapExpense),
        error: false,
        warning: 'A coluna recurrence_day não está disponível; as recorrências mensais usam o dia da despesa original.',
      }
    }
  }

  if (result.error && (isMissingColumn(result.error, 'is_recurring_monthly') || isMissingColumn(result.error, 'recurrence_day'))) {
    result = await runQuery(
      'Carregamento de recorrências semanais (compatibilidade)',
      supabase.from('finance_expenses').select(legacyExpenseColumns).eq('is_recurring_weekly', true).order('expense_date', { ascending: false }),
    )
    if (result.error) return { data: [], error: true }
    return {
      data: parseRows(expenseRowSchema, result.data, 'recorrências semanais').map(mapExpense),
      error: false,
      warning: 'A migração de recorrências mensais não está aplicada; apenas as semanais estão disponíveis.',
    }
  }

  if (result.error) return { data: [], error: true }
  return { data: parseRows(expenseRowSchema, result.data, 'despesas recorrentes').map(mapExpense), error: false }
}

async function loadOrdersInRange(
  supabase: AdminSupabase,
  start: string,
  endExclusive: string,
): Promise<LoadResult<FinanceOrderRow[]> & { paymentStatusAvailable: boolean }> {
  const from = financeDateToUtcIso(start)
  const until = financeDateToUtcIso(endExclusive)
  let result = await runQuery(
    'Carregamento de serviços da semana',
    supabase.from('orders')
      .select('id, status, total_amount, scheduled_date, payment_status')
      .gte('scheduled_date', from).lt('scheduled_date', until)
      .in('status', ['completed', ...activeStatuses])
      .order('scheduled_date', { ascending: true }),
  )

  if (result.error && isMissingColumn(result.error, 'payment_status')) {
    result = await runQuery(
      'Carregamento de serviços da semana (compatibilidade sem payment_status)',
      supabase.from('orders')
        .select('id, status, total_amount, scheduled_date')
        .gte('scheduled_date', from).lt('scheduled_date', until)
        .in('status', ['completed', ...activeStatuses])
        .order('scheduled_date', { ascending: true }),
    )
    return {
      data: result.error ? [] : parseOrderRows(result.data, 'serviços da semana'),
      error: Boolean(result.error),
      paymentStatusAvailable: false,
      warning: 'A coluna orders.payment_status não está disponível; o estado de pagamento não pode ser inferido.',
    }
  }

  return {
    data: result.error ? [] : parseOrderRows(result.data, 'serviços da semana'),
    error: Boolean(result.error),
    paymentStatusAvailable: !result.error,
  }
}

async function loadUnpaidOrders(supabase: AdminSupabase): Promise<LoadResult<FinanceUnpaidOrder[]> & { paymentStatusAvailable: boolean }> {
  const unpaidSelect = 'id, status, total_amount, scheduled_date, payment_status, service_type, clients!orders_client_id_fkey(name)'
  const legacySelect = 'id, status, total_amount, scheduled_date, service_type, clients!orders_client_id_fkey(name)'
  let result = await runQuery(
    'Carregamento de pagamentos pendentes',
    supabase.from('orders').select(unpaidSelect)
      .or('payment_status.is.null,payment_status.neq.paid')
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: true }),
  )
  let paymentStatusAvailable = true
  let warning: string | undefined

  if (result.error && isMissingColumn(result.error, 'payment_status')) {
    paymentStatusAvailable = false
    warning = 'A coluna orders.payment_status não está disponível; são apresentados pedidos não cancelados sem classificar o pagamento.'
    result = await runQuery(
      'Carregamento de pagamentos pendentes (compatibilidade sem payment_status)',
      supabase.from('orders').select(legacySelect)
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true }),
    )
  }

  if (result.error) {
    return { data: [], error: true, paymentStatusAvailable, warning: 'Não foi possível carregar os pagamentos pendentes.' }
  }

  const rows = parseRows(unpaidOrderRowSchema, result.data, 'pagamentos pendentes')
  const unpaidOrders = rows.map((row): FinanceUnpaidOrder => {
    const clients = Array.isArray(row.clients) ? row.clients[0] : row.clients
    return {
      id: row.id,
      service_type: row.service_type,
      total_amount: fromCents(toCents(row.total_amount)),
      scheduled_date: row.scheduled_date,
      payment_status: row.payment_status ?? null,
      client_name: clients?.name ?? 'Cliente',
    }
  })
  return { data: unpaidOrders, error: false, paymentStatusAvailable, warning }
}

async function loadRevolutTransactions(supabase: AdminSupabase): Promise<LoadResult<FinanceRevolutTransaction[]>> {
  let result = await runQuery(
    'Carregamento dos movimentos Revolut',
    supabase.from('revolut_transactions_log')
      .select('bank_tx_id, title, amount, direction, merchant_name, counterparty_name, transaction_at, category, matched_order_id, converted_extra_income_id')
      .order('created_at', { ascending: false }).limit(20),
  )

  if (result.error && isMissingColumn(result.error, 'converted_extra_income_id')) {
    result = await runQuery(
      'Carregamento dos movimentos Revolut (compatibilidade)',
      supabase.from('revolut_transactions_log')
        .select('bank_tx_id, title, amount, direction, merchant_name, counterparty_name, transaction_at, category, matched_order_id')
        .order('created_at', { ascending: false }).limit(20),
    )
    if (result.error) return { data: [], error: true, warning: 'A integração Revolut não está disponível neste momento.' }
  }

  if (result.error) return { data: [], error: true, warning: 'A integração Revolut não está disponível neste momento.' }
  const rows = parseRows(revolutRowSchema, result.data, 'movimentos Revolut')
  return {
    data: rows.map((row) => ({ ...row, amount: fromCents(toCents(row.amount)), converted_extra_income_id: row.converted_extra_income_id ?? null })),
    error: false,
  }
}

export default async function AdminFinancasPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await getAdminSession()
  if (!session.success) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-800">{session.error}</div>

  const params = await searchParams
  const today = financeToday()
  const requestedDate = params.week && isFinanceDateKey(params.week) ? params.week : today
  const week = financeWeekRange(requestedDate)
  const previousWeek = { start: addFinanceDays(week.start, -7), endExclusive: week.start }
  const month = financeMonthRange(week.start)
  const previousMonth = financeMonthRange(addFinanceDays(month.start, -1))
  const upcoming = { start: today, endExclusive: addFinanceDays(today, 35) }

  const [
    weekOrdersResult,
    weekExpensesResult,
    recurrenceResult,
    futureExpensesResult,
    weekIncomesResult,
    futureIncomesResult,
    revolutResult,
    unpaidOrdersResult,
    monthExpensesResult,
    previousMonthExpensesResult,
    previousWeekExpensesResult,
    monthOrdersResult,
    monthIncomesResult,
    rulesResult,
  ] = await Promise.all([
    loadOrdersInRange(session.supabase, week.start, week.endExclusive),
    loadExpenseRange(session.supabase, week.start, week.endExclusive, 'Despesas da semana'),
    loadRecurringExpenses(session.supabase),
    loadExpenseRange(session.supabase, upcoming.start, upcoming.endExclusive, 'Próximas despesas'),
    runQuery('Carregamento de rendas extra da semana', session.supabase.from('finance_extra_incomes').select('id, title, amount, category, income_date, notes').gte('income_date', week.start).lt('income_date', week.endExclusive).order('income_date', { ascending: false })),
    runQuery('Carregamento de rendas extra futuras', session.supabase.from('finance_extra_incomes').select('id, title, amount, category, income_date, notes').gte('income_date', upcoming.start).lt('income_date', upcoming.endExclusive).order('income_date', { ascending: true })),
    loadRevolutTransactions(session.supabase),
    loadUnpaidOrders(session.supabase),
    loadExpenseRange(session.supabase, month.start, month.endExclusive, 'Despesas do mês selecionado'),
    loadExpenseRange(session.supabase, previousMonth.start, month.start, 'Despesas do mês anterior'),
    loadExpenseRange(session.supabase, previousWeek.start, previousWeek.endExclusive, 'Despesas da semana anterior'),
    runQuery('Carregamento de serviços concluídos do mês', session.supabase.from('orders').select('id, status, total_amount, scheduled_date').eq('status', 'completed').gte('scheduled_date', financeDateToUtcIso(month.start)).lt('scheduled_date', financeDateToUtcIso(month.endExclusive)).order('scheduled_date', { ascending: true })),
    runQuery('Carregamento de rendas extra do mês', session.supabase.from('finance_extra_incomes').select('id, title, amount, category, income_date, notes').gte('income_date', month.start).lt('income_date', month.endExclusive).order('income_date', { ascending: false })),
    runQuery('Carregamento de regras financeiras', session.supabase.from('finance_allocation_rules').select('tax_reserve_pct, business_ops_pct, personal_weekly_pct, savings_pct, weekly_fixed_target').eq('id', FINANCE_RULES_ID).maybeSingle()),
  ])

  if (weekOrdersResult.error || weekExpensesResult.error) {
    return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-800">Não foi possível carregar os serviços e despesas da semana. Consulte o registo do servidor para ver os detalhes.</div>
  }

  const warnings = new Set<string>()
  const addWarning = (warning?: string) => { if (warning) warnings.add(warning) }
  const recurringExpenses = recurrenceResult.data
  const weekActuals = weekExpensesResult.data
  const previousWeekActuals = previousWeekExpensesResult.data
  const currentMonthActuals = monthExpensesResult.data
  const previousMonthActuals = previousMonthExpensesResult.data
  const futureActuals = futureExpensesResult.data

  for (const result of [
    recurrenceResult,
    futureExpensesResult,
    monthExpensesResult,
    previousMonthExpensesResult,
    previousWeekExpensesResult,
  ]) {
    addWarning(result.warning)
    if (result.error) addWarning(result.warning ?? 'Alguns dados de despesas ou recorrências não estão disponíveis.')
  }

  const weekExpenses = [
    ...weekActuals.map((item) => mapFinanceExpense(item)),
    ...generateExpenseOccurrences(recurringExpenses, week.start, week.endExclusive, weekActuals).map((item) => mapFinanceExpense(item, true)),
  ]
  const priorWeekExpenses = [
    ...previousWeekActuals.map((item) => mapFinanceExpense(item)),
    ...generateExpenseOccurrences(recurringExpenses, previousWeek.start, previousWeek.endExclusive, previousWeekActuals).map((item) => mapFinanceExpense(item, true)),
  ]
  const monthExpenses = [
    ...currentMonthActuals.map((item) => mapFinanceExpense(item)),
    ...generateExpenseOccurrences(recurringExpenses, month.start, month.endExclusive, currentMonthActuals).map((item) => mapFinanceExpense(item, true)),
  ]
  const priorMonthExpenses = [
    ...previousMonthActuals.map((item) => mapFinanceExpense(item)),
    ...generateExpenseOccurrences(recurringExpenses, previousMonth.start, previousMonth.endExclusive, previousMonthActuals).map((item) => mapFinanceExpense(item, true)),
  ]
  const upcomingExpenses = [
    ...futureActuals.map((item) => mapFinanceExpense(item)),
    ...generateExpenseOccurrences(recurringExpenses, upcoming.start, upcoming.endExclusive, futureActuals).map((item) => mapFinanceExpense(item, true)),
  ].sort((a, b) => a.expense_date.localeCompare(b.expense_date))

  const weekIncomeResult = weekIncomesResult.error
    ? { rows: [] as FinanceExtraIncome[], warning: 'As rendas extra da semana não estão disponíveis.' }
    : { rows: parseIncomeRows(weekIncomesResult.data, 'rendas extra da semana'), warning: undefined }
  const futureIncomeResult = futureIncomesResult.error
    ? { rows: [] as FinanceExtraIncome[], warning: 'As rendas extra futuras não estão disponíveis.' }
    : { rows: parseIncomeRows(futureIncomesResult.data, 'rendas extra futuras'), warning: undefined }
  const monthIncomeResult = monthIncomesResult.error
    ? { rows: [] as FinanceExtraIncome[], warning: 'As rendas extra do mês não estão disponíveis.' }
    : { rows: parseIncomeRows(monthIncomesResult.data, 'rendas extra do mês'), warning: undefined }
  addWarning(weekIncomeResult.warning)
  addWarning(futureIncomeResult.warning)
  addWarning(monthIncomeResult.warning)
  addWarning(revolutResult.warning)
  addWarning(unpaidOrdersResult.warning)
  if (rulesResult.error) addWarning('As regras financeiras não estão disponíveis; foram aplicados os valores padrão.')

  let rules = defaultRules
  if (!rulesResult.error && rulesResult.data) {
    const parsedRules = rulesRowSchema.safeParse(rulesResult.data)
    if (parsedRules.success) {
      rules = {
        tax_reserve_pct: fromCents(toCents(parsedRules.data.tax_reserve_pct)),
        business_ops_pct: fromCents(toCents(parsedRules.data.business_ops_pct)),
        personal_weekly_pct: fromCents(toCents(parsedRules.data.personal_weekly_pct)),
        savings_pct: fromCents(toCents(parsedRules.data.savings_pct)),
        weekly_fixed_target: fromCents(toCents(parsedRules.data.weekly_fixed_target)),
      }
    } else {
      console.error('[Finanças] Regras financeiras inválidas.', parsedRules.error.issues)
      addWarning('As regras financeiras estão inválidas; foram aplicados os valores padrão.')
    }
  }

  const orderRows = weekOrdersResult.data
  const monthOrderRows = monthOrdersResult.error
    ? []
    : parseOrderRows(monthOrdersResult.data, 'serviços concluídos do mês')
  if (monthOrdersResult.error) addWarning('A receita de limpezas do mês não está disponível.')

  const realizedCents = sumCents(orderRows.filter((order) => order.status === 'completed').map((order) => order.total_amount))
  const forecastCents = sumCents(orderRows.filter((order) => activeStatuses.includes(order.status)).map((order) => order.total_amount))
  const extraIncomeCents = sumCents(weekIncomeResult.rows.map((income) => income.amount))
  const personalExpenseCents = sumCents(weekExpenses.filter((item) => item.expense_type === 'personal').map((item) => item.amount))
  const businessExpenseCents = sumCents(weekExpenses.filter((item) => item.expense_type === 'business').map((item) => item.amount))
  const totalExpenseCents = personalExpenseCents + businessExpenseCents
  const daysRemaining = Math.max(1, financeDayDifference(today, week.endExclusive))
  const weekLabel = `${new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(`${week.start}T12:00:00Z`))} – ${new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(new Date(`${addFinanceDays(week.endExclusive, -1)}T12:00:00Z`))}`

  const unpaidOrders = unpaidOrdersResult.error || !unpaidOrdersResult.paymentStatusAvailable
    ? []
    : unpaidOrdersResult.data
  const monthOrderSummaries: FinanceOrderSummary[] = monthOrderRows.map((item) => ({ ...item, total_amount: fromCents(toCents(item.total_amount)) }))
  const data: FinanceData = {
    weekStart: week.start,
    weekEnd: addFinanceDays(week.endExclusive, -1),
    weekLabel,
    today,
    monthStart: month.start,
    realized: fromCents(realizedCents),
    forecast: fromCents(forecastCents),
    cleaningGross: fromCents(realizedCents + forecastCents),
    extraIncomeTotal: fromCents(extraIncomeCents),
    gross: fromCents(realizedCents + forecastCents + extraIncomeCents),
    expensesTotal: fromCents(totalExpenseCents),
    personalExpenses: fromCents(personalExpenseCents),
    businessExpenses: fromCents(businessExpenseCents),
    daysRemaining,
    rules,
    warnings: [...warnings],
    paymentStatusAvailable: unpaidOrdersResult.paymentStatusAvailable,
    unpaidOrdersAvailable: !unpaidOrdersResult.error && unpaidOrdersResult.paymentStatusAvailable,
    revolutAvailable: !revolutResult.error,
    expenses: weekExpenses,
    previousWeekExpenses: priorWeekExpenses,
    monthExpenses,
    previousMonthExpenses: priorMonthExpenses,
    extraIncomes: weekIncomeResult.rows,
    monthExtraIncomes: monthIncomeResult.rows,
    upcomingExpenses,
    upcomingExtraIncomes: futureIncomeResult.rows,
    orders: orderRows.map((item) => ({ ...item, total_amount: fromCents(toCents(item.total_amount)) })),
    monthOrders: monthOrderSummaries,
    revolutTransactions: revolutResult.data,
    unpaidOrders,
  }

  return <FinanceDashboard data={data} />
}
