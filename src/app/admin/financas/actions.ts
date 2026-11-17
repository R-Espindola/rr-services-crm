'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin-auth'

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }
const FINANCE_RULES_ID = '00000000-0000-0000-0000-000000000001'
const amountSchema = z.preprocess((value) => Number(String(value).replace(',', '.')), z.number().positive().max(10_000_000))
const booleanSchema = z.preprocess((value) => value === true || value === 'true' || value === 'on', z.boolean())
const nullableDaySchema = z.preprocess((value) => value === '' || value === undefined || value === null ? null : Number(value), z.number().int().min(1).max(31).nullable())

const rulesSchema = z.object({
  taxReservePct: z.coerce.number().min(0).max(100), businessOpsPct: z.coerce.number().min(0).max(100), personalWeeklyPct: z.coerce.number().min(0).max(100), savingsPct: z.coerce.number().min(0).max(100), weeklyFixedTarget: z.coerce.number().min(0).max(10_000_000),
}).refine((values) => values.taxReservePct + values.businessOpsPct + values.personalWeeklyPct + values.savingsPct <= 100, 'A soma das percentagens não pode ultrapassar 100%.')

const expenseSchema = z.object({
  title: z.string().trim().min(2).max(160), amount: amountSchema, expense_type: z.enum(['personal', 'business']), category: z.string().trim().min(1).max(80), expense_date: z.string().date(), is_recurring_weekly: booleanSchema, is_recurring_monthly: booleanSchema, recurrence_day: nullableDaySchema, notes: z.string().trim().max(1000),
}).transform((values) => ({ ...values, recurrence_day: values.is_recurring_monthly ? values.recurrence_day ?? Number(values.expense_date.slice(8, 10)) : null }))

const extraIncomeSchema = z.object({
  title: z.string().trim().min(2).max(160), amount: amountSchema, category: z.string().trim().min(1).max(80), income_date: z.string().date(), notes: z.string().trim().max(1000),
})

export async function saveFinanceRules(input: unknown): Promise<ActionResult<null>> {
  const parsed = rulesSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Verifique as regras financeiras.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { error } = await session.supabase.from('finance_allocation_rules').upsert({ id: FINANCE_RULES_ID, tax_reserve_pct: parsed.data.taxReservePct, business_ops_pct: parsed.data.businessOpsPct, personal_weekly_pct: parsed.data.personalWeeklyPct, savings_pct: parsed.data.savingsPct, weekly_fixed_target: parsed.data.weeklyFixedTarget, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) return { success: false, error: `Não foi possível guardar as regras financeiras: ${error.message}` }
  revalidatePath('/admin/financas')
  return { success: true, data: null }
}

export async function createFinanceExpense(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Verifique os dados do gasto.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { data, error } = await session.supabase.from('finance_expenses').insert({ title: parsed.data.title, amount: parsed.data.amount, expense_type: parsed.data.expense_type, category: parsed.data.category, expense_date: parsed.data.expense_date, is_recurring_weekly: parsed.data.is_recurring_weekly, is_recurring_monthly: parsed.data.is_recurring_monthly, recurrence_day: parsed.data.recurrence_day, notes: parsed.data.notes }).select('id').single()
  if (error || !data) return { success: false, error: `Não foi possível registar o gasto${error?.message ? `: ${error.message}` : '.'}` }
  revalidatePath('/admin/financas')
  return { success: true, data: { id: data.id as string } }
}

export async function updateFinanceExpenseRecurrence(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.string().uuid(), is_recurring_monthly: booleanSchema, recurrence_day: nullableDaySchema }).safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Recorrência inválida.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { error } = await session.supabase.from('finance_expenses').update({ is_recurring_monthly: parsed.data.is_recurring_monthly, recurrence_day: parsed.data.is_recurring_monthly ? parsed.data.recurrence_day : null, updated_at: new Date().toISOString() }).eq('id', parsed.data.id)
  if (error) return { success: false, error: `Não foi possível atualizar a recorrência: ${error.message}` }
  revalidatePath('/admin/financas')
  return { success: true, data: null }
}

export async function createFinanceExtraIncome(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = extraIncomeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Verifique os dados da renda extra.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { data, error } = await session.supabase.from('finance_extra_incomes').insert({ title: parsed.data.title, amount: parsed.data.amount, category: parsed.data.category, income_date: parsed.data.income_date, notes: parsed.data.notes || null }).select('id').single()
  if (error || !data) return { success: false, error: `Não foi possível registar a renda extra${error?.message ? `: ${error.message}` : '.'}` }
  revalidatePath('/admin/financas')
  return { success: true, data: { id: data.id as string } }
}

export async function deleteFinanceExpense(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.string().uuid().safeParse(input)
  if (!parsed.success) return { success: false, error: 'Gasto inválido.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { error } = await session.supabase.from('finance_expenses').delete().eq('id', parsed.data)
  if (error) return { success: false, error: `Não foi possível eliminar o gasto: ${error.message}` }
  revalidatePath('/admin/financas')
  return { success: true, data: null }
}

export async function deleteFinanceExtraIncome(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.string().uuid().safeParse(input)
  if (!parsed.success) return { success: false, error: 'Renda extra inválida.' }
  const session = await getAdminSession()
  if (!session.success) return session
  const { error } = await session.supabase.from('finance_extra_incomes').delete().eq('id', parsed.data)
  if (error) return { success: false, error: `Não foi possível eliminar a renda extra: ${error.message}` }
  revalidatePath('/admin/financas')
  return { success: true, data: null }
}
