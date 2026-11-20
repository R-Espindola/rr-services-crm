import { addFinanceDays, financeDateParts, financeDayDifference, financeMonthRange } from './dates'

export type RecurringExpense = {
  id: string
  expense_date: string
  is_recurring_weekly: boolean
  is_recurring_monthly: boolean
  recurrence_day: number | null
}

type DatedExpense = Pick<RecurringExpense, 'id' | 'expense_date'>
export type ExpenseOccurrence<T extends RecurringExpense> = T & {
  id: string
  expense_date: string
  is_virtual_recurring: true
}

function monthDay(date: string, requestedDay: number) {
  const range = financeMonthRange(date)
  const lastDay = financeDayDifference(range.start, range.endExclusive)
  return addFinanceDays(range.start, Math.min(requestedDay, lastDay) - 1)
}

export function generateExpenseOccurrences<T extends RecurringExpense>(
  recurringExpenses: readonly T[],
  start: string,
  endExclusive: string,
  recordedExpenses: readonly DatedExpense[] = [],
): ExpenseOccurrence<T>[] {
  if (financeDayDifference(start, endExclusive) <= 0) return []

  const recordedKeys = new Set(recordedExpenses.map((expense) => `${expense.id}:${expense.expense_date}`))
  const occurrenceByKey = new Map<string, ExpenseOccurrence<T>>()

  function addOccurrence(expense: T, date: string) {
    const key = `${expense.id}:${date}`
    if (date <= expense.expense_date || date < start || date >= endExclusive || recordedKeys.has(key)) return
    if (!occurrenceByKey.has(key)) {
      occurrenceByKey.set(key, {
        ...expense,
        id: key,
        expense_date: date,
        is_virtual_recurring: true,
      })
    }
  }

  for (const expense of recurringExpenses) {
    if (!expense.is_recurring_weekly && !expense.is_recurring_monthly) continue

    if (expense.is_recurring_weekly) {
      const daysFromOriginal = financeDayDifference(expense.expense_date, start)
      const occurrenceNumber = Math.max(1, Math.ceil(daysFromOriginal / 7))
      let date = addFinanceDays(expense.expense_date, occurrenceNumber * 7)
      while (date < endExclusive) {
        addOccurrence(expense, date)
        date = addFinanceDays(date, 7)
      }
    }

    if (expense.is_recurring_monthly) {
      const { day: originalDay } = financeDateParts(expense.expense_date)
      const recurrenceDay = expense.recurrence_day ?? originalDay
      let monthStart = financeMonthRange(start).start
      while (monthStart < endExclusive) {
        addOccurrence(expense, monthDay(monthStart, recurrenceDay))
        monthStart = financeMonthRange(monthStart).endExclusive
      }
    }
  }

  return [...occurrenceByKey.values()].sort((a, b) => a.expense_date.localeCompare(b.expense_date))
}
